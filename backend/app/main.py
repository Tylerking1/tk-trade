from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import stocks, kline, indicators, patterns, screener, sectors
from app.services.cache_service import clear_cache


@asynccontextmanager
async def lifespan(app: FastAPI):
    clear_cache()  # flush stale cache on every (re)start
    await init_db()
    yield


app = FastAPI(title="TK-Trade A股交易分析系统", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stocks.router)
app.include_router(kline.router)
app.include_router(indicators.router)
app.include_router(patterns.router)
app.include_router(screener.router)
app.include_router(sectors.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "TK-Trade API is running"}
