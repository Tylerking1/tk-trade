from datetime import datetime
from fastapi import APIRouter, Query
from app.services.sector_service import (
    get_sector_list,
    get_sector_daily,
    get_sector_rank,
    MARKET_INDICES,
)

router = APIRouter(prefix="/api/sectors", tags=["sectors"])


@router.get("/list")
async def list_sectors():
    """Return all market indices and SW Level-1 sector indices."""
    return get_sector_list()


@router.get("/kline")
async def sector_kline(
    ts_code: str = Query(..., description="指数/板块代码"),
    start_date: str = Query("", description="开始日期 YYYYMMDD"),
    end_date: str = Query("", description="结束日期 YYYYMMDD"),
):
    """Return K-line data for a sector or market index in the standard KlineItem format."""
    df = get_sector_daily(ts_code, start_date, end_date)

    if df.empty:
        return {"data": [], "indicators": {}}

    data = []
    for _, row in df.iterrows():
        try:
            timestamp = int(
                datetime.strptime(str(row["trade_date"])[:8], "%Y%m%d").timestamp() * 1000
            )
        except (ValueError, TypeError):
            continue

        def _f(col: str, default=None):
            v = row.get(col)
            if v is None:
                return default
            try:
                f = float(v)
                import math
                if math.isnan(f) or math.isinf(f):
                    return default
                return round(f, 2)
            except (TypeError, ValueError):
                return default

        item = {
            "timestamp": timestamp,
            "open": _f("open"),
            "high": _f("high"),
            "low": _f("low"),
            "close": _f("close"),
            "volume": _f("vol"),
            # index_daily `amount` is renamed to `turnover` in sector_service
            "turnover": _f("turnover"),
        }
        data.append(item)

    return {"data": data, "indicators": {}}


@router.get("/rank")
async def sector_rank():
    """Return all sectors and indices scored and sorted by composite strength."""
    results = get_sector_rank()
    return {"data": results, "total": len(results)}
