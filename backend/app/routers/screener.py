from fastapi import APIRouter, Query
from typing import Optional
import asyncio
import uuid
import time
from concurrent.futures import ThreadPoolExecutor
from app.services.tushare_service import get_daily_data, get_stock_list, get_stock_fundamentals
from app.services.screener_service import SCREENER_FUNCTIONS, calc_ai_score, calc_composite_score
from app.services.sector_service import get_sector_daily, get_sector_list, MARKET_INDICES

router = APIRouter(prefix="/api/screener", tags=["screener"])
executor = ThreadPoolExecutor(max_workers=6)

# In-memory job store: job_id → {status, progress, total, results, error}
_jobs: dict[str, dict] = {}
_JOBS_TTL = 600  # prune jobs older than 10 minutes


def _prune_jobs():
    now = time.time()
    stale = [jid for jid, j in _jobs.items() if now - j.get("created_at", now) > _JOBS_TTL]
    for jid in stale:
        del _jobs[jid]


def _filter_stocks(stocks, market: str, industry: str, exclude_st: bool):
    """Apply market / industry / ST filters to a stock DataFrame."""
    if market:
        stocks = stocks[stocks["market"] == market]
    if industry:
        stocks = stocks[stocks["industry"] == industry]
    if exclude_st:
        stocks = stocks[~stocks["name"].str.contains("ST", na=False)]
    return stocks


def _screen_single(ts_code: str, strategy: str) -> Optional[dict]:
    try:
        df = get_daily_data(ts_code)
        if df.empty or len(df) < 30:
            return None
        func = SCREENER_FUNCTIONS.get(strategy)
        if func and func(df):
            pct_chg = float(df["pct_chg"].iloc[-1]) if "pct_chg" in df.columns else 0.0
            return {
                "ts_code": ts_code,
                "close": round(float(df["close"].iloc[-1]), 2),
                "pct_chg": round(pct_chg, 2),
                "vol": round(float(df["vol"].iloc[-1]), 2),
            }
    except Exception:
        pass
    return None


def _score_single(ts_code: str) -> Optional[dict]:
    """Score one stock: fetch kline + fundamentals, compute composite score."""
    try:
        df = get_daily_data(ts_code)
        if df.empty or len(df) < 30:
            return None
        fundamentals = get_stock_fundamentals(ts_code)
        result = calc_composite_score(df, fundamentals)
        if result is None:
            return None
        result["ts_code"] = ts_code
        return result
    except Exception:
        return None


def _run_score_job(job_id: str, ts_codes: list[str], stock_names: dict, min_score: int):
    """Background thread: score all stocks, update job state incrementally."""
    job = _jobs[job_id]
    job["total"] = len(ts_codes)
    batch_size = 10

    for i in range(0, len(ts_codes), batch_size):
        if job.get("cancelled"):
            break
        batch = ts_codes[i: i + batch_size]
        for code in batch:
            r = _score_single(code)
            if r and r["composite"] >= min_score:
                r["name"] = stock_names.get(code, "")
                job["results"].append(r)
            job["progress"] += 1

    job["results"].sort(key=lambda x: x["composite"], reverse=True)
    job["status"] = "done"


@router.get("/industries")
async def list_industries():
    """Return sorted list of all industry categories."""
    stocks = get_stock_list()
    stocks = stocks[stocks["asset"] == "E"]
    industries = sorted(stocks["industry"].dropna().unique().tolist())
    return {"industries": industries}


@router.get("/strategies")
async def list_strategies():
    strategies = [
        {"key": "macd_golden_cross", "name": "MACD金叉", "category": "指标"},
        {"key": "ma_bullish", "name": "均线多头排列", "category": "指标"},
        {"key": "support_near", "name": "接近支撑位", "category": "形态"},
        {"key": "resistance_near", "name": "接近压力位", "category": "形态"},
        {"key": "ascending_channel", "name": "上升通道", "category": "形态"},
        {"key": "descending_channel", "name": "下降通道", "category": "形态"},
        {"key": "box_pattern", "name": "震荡箱体", "category": "形态"},
        {"key": "head_shoulders_top", "name": "头肩顶", "category": "形态"},
        {"key": "head_shoulders_bottom", "name": "头肩底", "category": "形态"},
        {"key": "volume_breakout", "name": "放量突破", "category": "量价"},
    ]
    return {"strategies": strategies}


@router.post("/run")
async def run_screener(
    strategy: str = Query(..., description="选股策略"),
    market: str = Query("", description="市场筛选"),
    industry: str = Query("", description="行业筛选"),
    exclude_st: bool = Query(False, description="排除ST股票"),
    limit: int = Query(50, ge=1, le=200),
):
    stocks = get_stock_list()
    stocks = stocks[stocks["asset"] == "E"]
    stocks = _filter_stocks(stocks, market, industry, exclude_st)

    ts_codes = stocks["ts_code"].tolist()[:500]

    loop = asyncio.get_event_loop()
    results = []

    batch_size = 20
    for i in range(0, len(ts_codes), batch_size):
        batch = ts_codes[i: i + batch_size]
        futures = [loop.run_in_executor(executor, _screen_single, code, strategy) for code in batch]
        batch_results = await asyncio.gather(*futures)
        for r in batch_results:
            if r:
                results.append(r)
        if len(results) >= limit:
            break

    stock_names = dict(zip(stocks["ts_code"], stocks["name"]))
    for r in results:
        r["name"] = stock_names.get(r["ts_code"], "")

    return {"strategy": strategy, "total": len(results), "data": results[:limit]}


@router.post("/score-rank/start")
async def start_score_rank(
    market: str = Query("", description="市场: 主板/创业板/科创板, 空=全部"),
    industry: str = Query("", description="行业筛选"),
    exclude_st: bool = Query(False, description="排除ST股票"),
    min_score: int = Query(60, ge=0, le=100, description="最低综合评分"),
    limit: int = Query(300, ge=0, description="最多扫描股票数，0=不限制"),
):
    """Start a background composite-scoring job. Returns job_id immediately."""
    _prune_jobs()

    stocks = get_stock_list()
    stocks = stocks[stocks["asset"] == "E"]
    stocks = _filter_stocks(stocks, market, industry, exclude_st)

    ts_codes = stocks["ts_code"].tolist() if limit == 0 else stocks["ts_code"].tolist()[:limit]
    stock_names = dict(zip(stocks["ts_code"], stocks["name"]))

    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {
        "status": "running",
        "progress": 0,
        "total": len(ts_codes),
        "results": [],
        "created_at": time.time(),
        "cancelled": False,
    }

    loop = asyncio.get_event_loop()
    loop.run_in_executor(executor, _run_score_job, job_id, ts_codes, stock_names, min_score)

    return {"job_id": job_id, "total": len(ts_codes)}


@router.get("/score-rank/{job_id}")
async def get_score_rank(job_id: str, top: int = Query(50, ge=1, le=200)):
    """Poll job status. Returns progress and top results sorted by composite score."""
    job = _jobs.get(job_id)
    if job is None:
        return {"error": "job not found"}

    results = sorted(job["results"], key=lambda x: x["composite"], reverse=True)

    return {
        "status": job["status"],
        "progress": job["progress"],
        "total": job["total"],
        "data": results[:top],
    }


@router.delete("/score-rank/{job_id}")
async def cancel_score_rank(job_id: str):
    job = _jobs.get(job_id)
    if job:
        job["cancelled"] = True
    return {"cancelled": True}


@router.get("/ai-score")
async def ai_score(
    ts_code: str = Query(..., description="股票/板块/指数代码"),
    start_date: str = Query("", description="开始日期"),
    end_date: str = Query("", description="结束日期"),
):
    # Detect sector/index codes: only known index/sector codes or SW sector (.SI suffix)
    _sector_codes = {item["ts_code"] for item in get_sector_list()["sectors"] + MARKET_INDICES}
    is_sector = ts_code in _sector_codes or ts_code.endswith(".SI")

    if is_sector:
        df = get_sector_daily(ts_code, start_date, end_date)
    else:
        df = get_daily_data(ts_code, start_date, end_date)

    if df is None or df.empty:
        return {"error": "无数据"}
    result = calc_ai_score(df)
    return result


