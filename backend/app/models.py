from sqlalchemy import Column, String, Float, Integer, Date, DateTime, Index, BigInteger
from sqlalchemy.sql import func
from app.database import Base


class StockBasic(Base):
    __tablename__ = "stock_basic"

    ts_code = Column(String(20), primary_key=True)
    symbol = Column(String(10), index=True)
    name = Column(String(50), index=True)
    area = Column(String(20))
    industry = Column(String(50))
    market = Column(String(20))
    list_date = Column(String(8))
    asset = Column(String(10), default="E")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class DailyPrice(Base):
    __tablename__ = "daily_price"
    __table_args__ = (
        Index("ix_daily_ts_date", "ts_code", "trade_date"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    ts_code = Column(String(20), nullable=False)
    trade_date = Column(String(8), nullable=False)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    pre_close = Column(Float)
    change = Column(Float)
    pct_chg = Column(Float)
    vol = Column(Float)
    amount = Column(Float)
    turnover_rate = Column(Float)
