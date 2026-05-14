from fastapi import APIRouter, Query
from sqlalchemy import select, or_, func
from app.database import async_session
from app.models import StockBasic
from app.services.tushare_service import get_stock_list, get_stock_fundamentals

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


@router.get("/sync")
async def sync_stock_list():
    stocks = get_stock_list()
    etfs = get_stock_list(asset="FD")
    import pandas as pd
    all_data = pd.concat([stocks, etfs], ignore_index=True)

    async with async_session() as session:
        for _, row in all_data.iterrows():
            existing = await session.get(StockBasic, row["ts_code"])
            if existing:
                existing.name = row["name"]
                existing.area = row.get("area", "")
                existing.industry = row.get("industry", "")
                existing.market = row.get("market", "")
                existing.asset = row.get("asset", "E")
            else:
                stock = StockBasic(
                    ts_code=row["ts_code"],
                    symbol=row["symbol"],
                    name=row["name"],
                    area=row.get("area", ""),
                    industry=row.get("industry", ""),
                    market=row.get("market", ""),
                    list_date=row.get("list_date", ""),
                    asset=row.get("asset", "E"),
                )
                session.add(stock)
        await session.commit()

    return {"message": f"Synced {len(all_data)} stocks/ETFs"}


@router.get("/list")
async def list_stocks(
    keyword: str = Query("", description="搜索关键词"),
    asset: str = Query("", description="资产类型: E=股票, FD=ETF"),
    market: str = Query("", description="市场: 主板/创业板/科创板/ETF"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    async with async_session() as session:
        query = select(StockBasic)

        if keyword:
            query = query.where(
                or_(
                    StockBasic.ts_code.contains(keyword),
                    StockBasic.symbol.contains(keyword),
                    StockBasic.name.contains(keyword),
                )
            )
        if asset:
            query = query.where(StockBasic.asset == asset)
        if market:
            query = query.where(StockBasic.market == market)

        query = query.order_by(StockBasic.ts_code)
        count_result = await session.execute(select(func.count()).select_from(query.subquery()))
        total = count_result.scalar()
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await session.execute(query)
        stocks = result.scalars().all()

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": [
                {
                    "ts_code": s.ts_code,
                    "symbol": s.symbol,
                    "name": s.name,
                    "area": s.area,
                    "industry": s.industry,
                    "market": s.market,
                    "list_date": s.list_date,
                    "asset": s.asset,
                }
                for s in stocks
            ],
        }


@router.get("/fundamentals/{ts_code}")
async def get_fundamentals(ts_code: str):
    data = get_stock_fundamentals(ts_code)
    return data
