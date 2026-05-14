import math
import pandas as pd
from datetime import datetime, timedelta
from app.services.cache_service import cached
from app.services.tushare_service import pro

# Major market indices (always active)
MARKET_INDICES = [
    {"ts_code": "000001.SH", "name": "上证综指", "type": "index"},
    {"ts_code": "000300.SH", "name": "沪深300", "type": "index"},
    {"ts_code": "399001.SZ", "name": "深证成指", "type": "index"},
    {"ts_code": "399006.SZ", "name": "创业板指", "type": "index"},
    {"ts_code": "000905.SH", "name": "中证500", "type": "index"},
    {"ts_code": "000016.SH", "name": "上证50", "type": "index"},
]

# Dynamically loaded SW L1 active sectors (cached 24h, built once on first call)
_SECTORS_CACHE: list = []


def _load_sw_sectors() -> list:
    """
    Fetch active SW Level-1 A-share sector indices from Tushare index_basic.
    Rules:
      - Code range 801010–801980 (standard SW A-share industry codes)
      - Numeric code ends in '0' (L1 pattern; L2/L3 end in non-zero digits)
      - Name does NOT contain '退市'
    """
    try:
        df = pro.index_basic(market="SW", level="L1")
        if df is None or df.empty:
            return []
        # Only standard A-share SW industry codes: 801010 to 801980
        def _valid(ts_code: str) -> bool:
            num_str = ts_code[:-3]  # strip '.SI'
            if not num_str.isdigit():
                return False
            num = int(num_str)
            return 801010 <= num <= 801980 and num_str.endswith("0")

        df = df[~df["name"].str.contains("退市", na=False)]
        df = df[df["ts_code"].apply(_valid)]
        # Strip "(申万)" suffix for display
        df = df.copy()
        df["display_name"] = df["name"].str.replace(r"\(申万\)$", "", regex=True).str.strip()
        sectors = [
            {"ts_code": row["ts_code"], "name": row["display_name"], "type": "sector"}
            for _, row in df.iterrows()
        ]
        return sorted(sectors, key=lambda x: x["ts_code"])
    except Exception:
        return []


def _get_sectors() -> list:
    global _SECTORS_CACHE
    if not _SECTORS_CACHE:
        _SECTORS_CACHE = _load_sw_sectors()
    return _SECTORS_CACHE


def get_sector_list() -> dict:
    return {"indices": MARKET_INDICES, "sectors": _get_sectors()}


@cached(ttl=1800)
def get_sector_daily(ts_code: str, start_date: str = "", end_date: str = "") -> pd.DataFrame:
    """Fetch index/sector daily K-line. Uses sw_daily for .SI codes, index_daily for others."""
    if not end_date:
        end_date = datetime.now().strftime("%Y%m%d")
    if not start_date:
        start_date = (datetime.now() - timedelta(days=365)).strftime("%Y%m%d")

    try:
        if ts_code.endswith(".SI"):
            # sw_daily doesn't reliably support start/end date filtering — fetch all, slice in Python
            df = pro.sw_daily(ts_code=ts_code)
            if df is not None and not df.empty:
                df = df.rename(columns={"pct_change": "pct_chg", "amount": "turnover"})
                df = df[(df["trade_date"] >= start_date) & (df["trade_date"] <= end_date)]
        else:
            df = pro.index_daily(ts_code=ts_code, start_date=start_date, end_date=end_date)
            if df is not None and not df.empty:
                df = df.rename(columns={"amount": "turnover"})
    except Exception:
        return pd.DataFrame()

    if df is None or df.empty:
        return pd.DataFrame()

    return df.sort_values("trade_date").reset_index(drop=True)


def _safe_float(val, default: float = 0.0) -> float:
    """Convert a value to float, returning default on NaN/None/error."""
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (TypeError, ValueError):
        return default


def calc_sector_score(ts_code: str, name: str) -> dict | None:
    """
    Score a sector/index using the same calc_ai_score algorithm as individual stocks,
    plus extra display metrics (pct_chg_1d, pct_chg_5d, vol_ratio).
    Not cached — get_sector_rank() wraps results in its own cache.
    """
    from app.services.screener_service import calc_ai_score  # avoid circular import at module level

    df = get_sector_daily(ts_code)
    if df.empty or len(df) < 20:
        return None

    # calc_ai_score requires at least 60 rows; if shorter, still try — it returns score=0 with "数据不足"
    ai = calc_ai_score(df)

    close = df["close"].astype(float)
    vol = df["vol"].astype(float) if "vol" in df.columns else pd.Series([0.0] * len(df))

    last_close = _safe_float(close.iloc[-1])
    pct_chg_1d = _safe_float(df["pct_chg"].iloc[-1] if "pct_chg" in df.columns else None, 0.0)

    if len(df) >= 6:
        prev_close = _safe_float(close.iloc[-6])
        pct_chg_5d = round(((last_close / prev_close) - 1) * 100, 2) if prev_close != 0 else 0.0
    else:
        pct_chg_5d = 0.0

    avg_vol_5d = float(vol.iloc[-5:].mean()) if len(vol) >= 5 else float(vol.mean())
    avg_vol_20d = float(vol.iloc[-20:].mean()) if len(vol) >= 20 else float(vol.mean())
    for v in (avg_vol_5d, avg_vol_20d):
        if math.isnan(v) or math.isinf(v):
            avg_vol_5d, avg_vol_20d = 0.0, 1.0
    vol_ratio = round(avg_vol_5d / avg_vol_20d, 2) if avg_vol_20d > 0 else 1.0

    return {
        "ts_code": ts_code,
        "name": name,
        "score": ai["score"],
        "recommendation": ai["recommendation"],
        "signals": ai["signals"],
        "pct_chg_1d": round(pct_chg_1d, 2),
        "pct_chg_5d": pct_chg_5d,
        "close": round(last_close, 2),
        "vol_ratio": vol_ratio,
    }


@cached(ttl=900)
def get_sector_rank() -> list:
    """Score all sectors and indices, return sorted descending by score."""
    all_items = MARKET_INDICES + _get_sectors()
    results = []
    for item in all_items:
        try:
            scored = calc_sector_score(item["ts_code"], item["name"])
            if scored is not None:
                scored["type"] = item["type"]
                results.append(scored)
        except Exception:
            continue
    results.sort(key=lambda x: x["score"], reverse=True)
    return results
