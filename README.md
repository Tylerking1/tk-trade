# TK Trade — A股交易分析系统

A股分析平台，支持K线图、技术指标、形态识别、智能选股。

## 功能

- **K线图**：日线蜡烛图，前复权数据（Tushare）
- **技术指标**：MA / MACD / KDJ / RSI / BOLL / WR / DMI / OBV
- **手动画线**：水平线、趋势线、矩形、平行通道、斐波那契
- **自动画线**：支撑/压力位、趋势通道、震荡箱体、头肩顶/底
- **智能选股**：10种技术形态策略批量筛选
- **AI评分**：基于多指标的 0–100 综合评分
- **股票列表**：全量A股 + ETF，支持搜索/分类/分页

---

## 快速启动

### 1. 配置 Tushare Token

编辑 `backend/.env`（已有示例文件）：

```
TUSHARE_TOKEN=你的Token
DATABASE_URL=sqlite+aiosqlite:///./data/trade.db
```

> 在 [tushare.pro](https://tushare.pro) 注册获取 Token。

---

### 2. 启动后端

```bash
cd backend

# 首次：创建虚拟环境并安装依赖
python3 -m venv venv
venv/bin/pip install -r requirements.txt

# 启动（开发模式，支持热重载）
venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

验证是否启动成功：
```bash
curl http://localhost:8000/api/health
# 返回: {"status":"ok","message":"TK-Trade API is running"}
```

---

### 3. 启动前端

```bash
cd frontend

# 首次：安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开浏览器访问：**http://localhost:5173**

---

### 4. 同步股票数据（首次必做）

前后端都启动后，在页面左侧股票列表右上角点击 **刷新图标**，从 Tushare 拉取全量A股 + ETF 数据写入本地数据库（约需 10–30 秒）。

同步完成后即可搜索股票、查看K线。

---

## 使用说明

| 区域 | 功能 |
|------|------|
| 左侧股票列表 | 搜索、按类型筛选（股票/ETF）、翻页 |
| 顶部栏 | 当前股票价格涨跌幅、日期范围切换 |
| 中部K线图 | 蜡烛图 + 指标面板切换（VOL/MACD/KDJ 等）|
| 左侧工具栏 | 手动画线工具、一键自动识别形态 |
| 右侧分析面板 | AI综合评分（当前股票）、智能选股 |

---

## 项目结构

```
tk-trade/
├── backend/
│   ├── app/
│   │   ├── main.py              FastAPI 入口
│   │   ├── config.py            配置（读取 .env）
│   │   ├── database.py          SQLAlchemy async + SQLite
│   │   ├── models.py            数据模型（StockBasic, DailyPrice）
│   │   ├── routers/             API 路由
│   │   │   ├── stocks.py        股票列表同步/查询
│   │   │   ├── kline.py         K线数据 + 指标
│   │   │   ├── patterns.py      形态识别
│   │   │   └── screener.py      智能选股 + AI评分
│   │   └── services/
│   │       ├── tushare_service.py   Tushare 数据获取（带缓存）
│   │       ├── indicator_service.py 技术指标计算
│   │       ├── pattern_service.py   形态识别算法
│   │       ├── screener_service.py  选股策略 + AI评分
│   │       └── cache_service.py     内存缓存（30分钟TTL）
│   ├── requirements.txt
│   └── .env                     ← 填入你的 TUSHARE_TOKEN
│
└── frontend/
    ├── src/
    │   ├── App.tsx              应用入口，全局状态管理
    │   ├── components/
    │   │   ├── TopBar/          顶部价格栏 + 日期选择
    │   │   ├── StockList/       左侧股票列表
    │   │   ├── Toolbar/         画线工具栏
    │   │   ├── Chart/           K线图（klinecharts v9）
    │   │   └── Screener/        AI分析 + 智能选股
    │   ├── hooks/               useStocks, useKline
    │   ├── services/api.ts      axios API 客户端
    │   └── types/index.ts       TypeScript 类型定义
    └── package.json
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 后端框架 | FastAPI 0.115 |
| 数据库 | SQLite（async via aiosqlite + SQLAlchemy） |
| 数据源 | Tushare Pro API |
| 技术分析 | pandas + numpy + scipy |
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 7 |
| 样式 | Tailwind CSS v4 |
| 图表 | klinecharts v9 |
