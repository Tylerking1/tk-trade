import tushare as ts
import pandas as pd
from datetime import datetime, timedelta
from app.config import TUSHARE_TOKEN
from app.services.cache_service import cached

pro = ts.pro_api(TUSHARE_TOKEN)


def get_stock_list(asset: str = "E") -> pd.DataFrame:
    if asset == "FD":
        df = pro.fund_basic(market="E", fields="ts_code,name,management,type,found_date,list_date,status")
        df = df[df["status"] == "L"].copy()
        df = df.rename(columns={"found_date": "list_date_orig"})
        df.loc[:, "symbol"] = df["ts_code"].str.split(".").str[0]
        df.loc[:, "area"] = ""
        df.loc[:, "industry"] = df["type"].fillna("")
        df.loc[:, "market"] = "ETF"
        df.loc[:, "asset"] = "FD"
        return df[["ts_code", "symbol", "name", "area", "industry", "market", "list_date", "asset"]]

    df = pro.stock_basic(
        exchange="",
        list_status="L",
        fields="ts_code,symbol,name,area,industry,market,list_date",
    )
    df["asset"] = "E"
    return df


@cached(ttl=1800)
def get_daily_data(ts_code: str, start_date: str = "", end_date: str = "", period: str = "D") -> pd.DataFrame:
    if not end_date:
        end_date = datetime.now().strftime("%Y%m%d")
    if not start_date:
        if period == "W":
            start_date = (datetime.now() - timedelta(days=365 * 3)).strftime("%Y%m%d")
        elif period == "M":
            start_date = (datetime.now() - timedelta(days=365 * 5)).strftime("%Y%m%d")
        else:
            start_date = (datetime.now() - timedelta(days=365)).strftime("%Y%m%d")

    if period == "D" and (".OF" in ts_code or ts_code.startswith("5") or ts_code.startswith("1")):
        try:
            df = pro.fund_daily(ts_code=ts_code, start_date=start_date, end_date=end_date)
            if df is not None and not df.empty:
                return df.sort_values("trade_date")
        except Exception:
            pass

    df = ts.pro_bar(
        ts_code=ts_code,
        start_date=start_date,
        end_date=end_date,
        adj="qfq",
        freq=period,
        factors=["tor"],
    )
    if df is None or df.empty:
        return pd.DataFrame()
    df = df.rename(columns={"turnover_rate": "turnover_rate"})
    return df.sort_values("trade_date")


@cached(ttl=3600)
def get_stock_fundamentals(ts_code: str) -> dict:
    import math

    def clean(v):
        """Convert nan/inf to None for JSON safety."""
        if v is None:
            return None
        try:
            f = float(v)
            return None if (math.isnan(f) or math.isinf(f)) else f
        except (TypeError, ValueError):
            return v

    def cleanr(v, decimals=2):
        c = clean(v)
        return round(c, decimals) if c is not None else None

    result: dict = {}

    # Latest valuation / market cap from daily_basic
    try:
        db = pro.daily_basic(
            ts_code=ts_code,
            trade_date="",
            fields="ts_code,trade_date,pe_ttm,pb,dv_ttm,total_mv,circ_mv,turnover_rate",
        )
        if db is not None and not db.empty:
            row = db.iloc[0]
            total_mv = clean(row["total_mv"])
            circ_mv = clean(row["circ_mv"])
            result["valuation"] = {
                "pe_ttm": cleanr(row["pe_ttm"]),
                "pb": cleanr(row["pb"]),
                "dv_ttm": cleanr(row["dv_ttm"]),
                "total_mv": round(total_mv / 10000, 2) if total_mv else None,
                "circ_mv": round(circ_mv / 10000, 2) if circ_mv else None,
                "turnover_rate": cleanr(row["turnover_rate"], 4),
            }
    except Exception:
        pass

    # Latest annual financials: EPS, ROE, ROA, net profit growth, revenue growth
    try:
        fi = pro.fina_indicator(
            ts_code=ts_code,
            period="",
            fields="ts_code,end_date,eps,roe,roa,netprofit_yoy,or_yoy,bps,debt_to_assets",
        )
        if fi is not None and not fi.empty:
            fi_annual = fi[fi["end_date"].str.endswith("1231")]
            row = fi_annual.iloc[0] if not fi_annual.empty else fi.iloc[0]
            result["performance"] = {
                "end_date": str(row["end_date"]),
                "eps": cleanr(row["eps"]),
                "roe": cleanr(row["roe"]),
                "roa": cleanr(row["roa"]),
                "netprofit_yoy": cleanr(row["netprofit_yoy"]),
                "or_yoy": cleanr(row["or_yoy"]),
                "bps": cleanr(row["bps"]),
                "debt_to_assets": cleanr(row["debt_to_assets"]),
            }
    except Exception:
        pass

    # Net profit and revenue from income statement
    try:
        inc = pro.income(
            ts_code=ts_code,
            period="",
            fields="ts_code,end_date,total_revenue,n_income_attr_p",
        )
        if inc is not None and not inc.empty:
            inc_annual = inc[inc["end_date"].str.endswith("1231")]
            row = inc_annual.iloc[0] if not inc_annual.empty else inc.iloc[0]
            rev = clean(row["total_revenue"])
            profit = clean(row["n_income_attr_p"])
            result["income"] = {
                "end_date": str(row["end_date"]),
                "total_revenue": round(rev / 1e8, 2) if rev is not None else None,
                "net_profit": round(profit / 1e8, 2) if profit is not None else None,
            }
    except Exception:
        pass

    # Latest dividend
    try:
        div = pro.dividend(
            ts_code=ts_code,
            fields="ts_code,end_date,cash_div_tax,div_proc,ex_date,pay_date",
        )
        if div is not None and not div.empty:
            confirmed = div[div["div_proc"].isin(["实施", "股东大会通过"])]
            row = confirmed.iloc[0] if not confirmed.empty else div.iloc[0]
            result["dividend"] = {
                "cash_div_tax": cleanr(row["cash_div_tax"], 3),
                "div_proc": str(row["div_proc"]),
                "ex_date": str(row["ex_date"]) if row["ex_date"] else None,
                "pay_date": str(row["pay_date"]) if row["pay_date"] else None,
            }
    except Exception:
        pass

    # Stock concepts (top 8)
    try:
        concepts = pro.concept_detail(ts_code=ts_code, fields="ts_code,concept_name")
        if concepts is not None and not concepts.empty:
            result["concepts"] = concepts["concept_name"].tolist()[:8]
    except Exception:
        pass

    return result

