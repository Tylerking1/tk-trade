from fastapi import APIRouter, Query
from app.services.tushare_service import get_daily_data
from app.services.indicator_service import calc_all_indicators

router = APIRouter(prefix="/api/indicators", tags=["indicators"])


@router.get("/calc")
async def calc_indicators(
    ts_code: str = Query(..., description="股票代码"),
    start_date: str = Query("", description="开始日期"),
    end_date: str = Query("", description="结束日期"),
):
    df = get_daily_data(ts_code, start_date, end_date)
    if df.empty:
        return {"indicators": {}}
    indicators = calc_all_indicators(df)
    return {"indicators": indicators}
