from fastapi import APIRouter, Query
from app.services.tushare_service import get_daily_data
from app.services.pattern_service import detect_all_patterns

router = APIRouter(prefix="/api/patterns", tags=["patterns"])


@router.get("/detect")
async def detect_patterns(
    ts_code: str = Query(..., description="股票代码"),
    start_date: str = Query("", description="开始日期"),
    end_date: str = Query("", description="结束日期"),
):
    df = get_daily_data(ts_code, start_date, end_date)
    if df.empty:
        return {"patterns": {}}
    patterns = detect_all_patterns(df)
    return {"patterns": patterns}
