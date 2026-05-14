from fastapi import APIRouter, Query
from app.services.tushare_service import get_daily_data
from app.services.indicator_service import calc_all_indicators

router = APIRouter(prefix="/api/kline", tags=["kline"])


@router.get("/daily")
async def get_daily(
    ts_code: str = Query(..., description="股票代码"),
    start_date: str = Query("", description="开始日期 YYYYMMDD"),
    end_date: str = Query("", description="结束日期 YYYYMMDD"),
    period: str = Query("D", description="周期 D/W/M"),
):
    df = get_daily_data(ts_code, start_date, end_date, period)
    if df.empty:
        return {"data": [], "indicators": {}}

    indicators = calc_all_indicators(df)

    data = []
    for _, row in df.iterrows():
        item = {
            "timestamp": int(
                __import__("datetime").datetime.strptime(
                    str(row["trade_date"])[:8], "%Y%m%d"
                ).timestamp()
                * 1000
            ),
            "open": round(float(row["open"]), 2) if row["open"] else None,
            "high": round(float(row["high"]), 2) if row["high"] else None,
            "low": round(float(row["low"]), 2) if row["low"] else None,
            "close": round(float(row["close"]), 2) if row["close"] else None,
            "volume": round(float(row["vol"]), 2) if row.get("vol") else None,
            "turnover": round(float(row["amount"]), 2) if row.get("amount") else None,
        }
        data.append(item)

    return {"data": data, "indicators": indicators}
