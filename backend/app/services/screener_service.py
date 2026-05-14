import numpy as np
import pandas as pd
from typing import Optional
from app.services.indicator_service import calc_macd, calc_rsi, calc_ma, calc_boll
from app.services.pattern_service import (
    find_support_resistance,
    detect_channel,
    detect_box,
    detect_head_and_shoulders,
)


def screen_by_macd_golden_cross(df: pd.DataFrame) -> bool:
    if len(df) < 30:
        return False
    macd = calc_macd(df["close"])
    dif = macd["dif"]
    dea = macd["dea"]
    if len(dif) < 2:
        return False
    return float(dif.iloc[-1]) > float(dea.iloc[-1]) and float(dif.iloc[-2]) <= float(dea.iloc[-2])


def screen_by_ma_bullish(df: pd.DataFrame) -> bool:
    if len(df) < 60:
        return False
    ma5 = calc_ma(df["close"], 5)
    ma10 = calc_ma(df["close"], 10)
    ma20 = calc_ma(df["close"], 20)
    return float(ma5.iloc[-1]) > float(ma10.iloc[-1]) > float(ma20.iloc[-1])


def screen_by_support_near(df: pd.DataFrame, threshold: float = 0.03) -> bool:
    if len(df) < 60:
        return False
    sr = find_support_resistance(df)
    current_price = float(df["close"].iloc[-1])
    for level in sr["support"]:
        if abs(current_price - level["price"]) / current_price < threshold:
            return True
    return False


def screen_by_resistance_near(df: pd.DataFrame, threshold: float = 0.03) -> bool:
    if len(df) < 60:
        return False
    sr = find_support_resistance(df)
    current_price = float(df["close"].iloc[-1])
    for level in sr["resistance"]:
        if abs(current_price - level["price"]) / current_price < threshold:
            return True
    return False


def screen_by_channel(df: pd.DataFrame, channel_type: str = "ascending") -> bool:
    channel = detect_channel(df)
    return channel is not None and channel["type"] == channel_type


def screen_by_box(df: pd.DataFrame) -> bool:
    return detect_box(df) is not None


def screen_by_head_shoulders(df: pd.DataFrame, is_top: bool = True) -> bool:
    return detect_head_and_shoulders(df, is_top=is_top) is not None


def screen_by_volume_price(df: pd.DataFrame, vol_ratio: float = 2.0) -> bool:
    if len(df) < 20:
        return False
    avg_vol = df["vol"].tail(20).mean()
    latest_vol = float(df["vol"].iloc[-1])
    latest_pct = float(df.get("pct_chg", df["close"].pct_change() * 100).iloc[-1])
    return latest_vol > avg_vol * vol_ratio and latest_pct > 0


def calc_ai_score(df: pd.DataFrame) -> dict:
    if len(df) < 60:
        return {"score": 0, "signals": [], "recommendation": "数据不足"}

    score = 50
    signals = []

    macd = calc_macd(df["close"])
    if float(macd["dif"].iloc[-1]) > float(macd["dea"].iloc[-1]):
        score += 10
        signals.append({"name": "MACD金叉", "type": "bullish", "weight": 10})
    else:
        score -= 5
        signals.append({"name": "MACD死叉", "type": "bearish", "weight": -5})

    ma5 = calc_ma(df["close"], 5)
    ma20 = calc_ma(df["close"], 20)
    if float(ma5.iloc[-1]) > float(ma20.iloc[-1]):
        score += 8
        signals.append({"name": "MA5>MA20多头排列", "type": "bullish", "weight": 8})
    else:
        score -= 5
        signals.append({"name": "MA5<MA20空头排列", "type": "bearish", "weight": -5})

    rsi = calc_rsi(df["close"], 14)
    rsi_val = float(rsi.iloc[-1])
    if rsi_val < 30:
        score += 10
        signals.append({"name": f"RSI超卖({rsi_val:.1f})", "type": "bullish", "weight": 10})
    elif rsi_val > 70:
        score -= 10
        signals.append({"name": f"RSI超买({rsi_val:.1f})", "type": "bearish", "weight": -10})

    boll = calc_boll(df["close"])
    current = float(df["close"].iloc[-1])
    if current < float(boll["lower"].iloc[-1]):
        score += 8
        signals.append({"name": "价格低于布林下轨", "type": "bullish", "weight": 8})
    elif current > float(boll["upper"].iloc[-1]):
        score -= 8
        signals.append({"name": "价格高于布林上轨", "type": "bearish", "weight": -8})

    if len(df) >= 20:
        avg_vol = df["vol"].tail(20).mean()
        latest_vol = float(df["vol"].iloc[-1])
        pct_chg = float(df["close"].pct_change().iloc[-1]) * 100
        if latest_vol > avg_vol * 1.5 and pct_chg > 0:
            score += 7
            signals.append({"name": "放量上涨", "type": "bullish", "weight": 7})
        elif latest_vol > avg_vol * 1.5 and pct_chg < 0:
            score -= 7
            signals.append({"name": "放量下跌", "type": "bearish", "weight": -7})

    sr = find_support_resistance(df)
    for level in sr["support"]:
        if abs(current - level["price"]) / current < 0.02:
            score += 5
            signals.append({"name": f"接近支撑位({level['price']:.2f})", "type": "bullish", "weight": 5})
            break

    channel = detect_channel(df)
    if channel:
        if channel["type"] == "ascending":
            score += 6
            signals.append({"name": "上升通道", "type": "bullish", "weight": 6})
        elif channel["type"] == "descending":
            score -= 6
            signals.append({"name": "下降通道", "type": "bearish", "weight": -6})

    hs_top = detect_head_and_shoulders(df, is_top=True)
    if hs_top:
        score -= 10
        signals.append({"name": "头肩顶形态", "type": "bearish", "weight": -10})

    hs_bottom = detect_head_and_shoulders(df, is_top=False)
    if hs_bottom:
        score += 10
        signals.append({"name": "头肩底形态", "type": "bullish", "weight": 10})

    score = max(0, min(100, score))

    if score >= 70:
        recommendation = "强烈看多"
    elif score >= 60:
        recommendation = "看多"
    elif score >= 40:
        recommendation = "中性"
    elif score >= 30:
        recommendation = "看空"
    else:
        recommendation = "强烈看空"

    return {
        "score": score,
        "signals": signals,
        "recommendation": recommendation,
    }


SCREENER_FUNCTIONS = {
    "macd_golden_cross": screen_by_macd_golden_cross,
    "ma_bullish": screen_by_ma_bullish,
    "support_near": screen_by_support_near,
    "resistance_near": screen_by_resistance_near,
    "ascending_channel": lambda df: screen_by_channel(df, "ascending"),
    "descending_channel": lambda df: screen_by_channel(df, "descending"),
    "box_pattern": screen_by_box,
    "head_shoulders_top": lambda df: screen_by_head_shoulders(df, True),
    "head_shoulders_bottom": lambda df: screen_by_head_shoulders(df, False),
    "volume_breakout": screen_by_volume_price,
}


def calc_composite_score(df: pd.DataFrame, fundamentals: dict) -> dict:
    """
    Composite score combining technical signals (60%) + fundamentals (40%).
    Returns score 0-100, breakdown dict, and key metrics for display.
    """
    if len(df) < 30:
        return None

    tech_score = 50
    fund_score = 50
    signals = []

    # ── Technical (60 pts total weight) ─────────────────────────────────────
    # MACD
    try:
        macd = calc_macd(df["close"])
        dif, dea = float(macd["dif"].iloc[-1]), float(macd["dea"].iloc[-1])
        if dif > dea:
            tech_score += 10
            signals.append({"name": "MACD金叉", "type": "bullish", "weight": 10})
        else:
            tech_score -= 5
    except Exception:
        pass

    # MA trend
    try:
        ma5 = float(calc_ma(df["close"], 5).iloc[-1])
        ma20 = float(calc_ma(df["close"], 20).iloc[-1])
        ma60 = float(calc_ma(df["close"], 60).iloc[-1]) if len(df) >= 60 else ma20
        if ma5 > ma20 > ma60:
            tech_score += 12
            signals.append({"name": "均线多头排列", "type": "bullish", "weight": 12})
        elif ma5 < ma20 < ma60:
            tech_score -= 8
    except Exception:
        pass

    # RSI
    try:
        rsi_val = float(calc_rsi(df["close"], 14).iloc[-1])
        if rsi_val < 35:
            tech_score += 10
            signals.append({"name": f"RSI超卖({rsi_val:.0f})", "type": "bullish", "weight": 10})
        elif rsi_val > 65:
            tech_score -= 8
            signals.append({"name": f"RSI超买({rsi_val:.0f})", "type": "bearish", "weight": -8})
    except Exception:
        pass

    # Volume breakout
    try:
        if len(df) >= 20:
            avg_vol = float(df["vol"].tail(20).mean())
            latest_vol = float(df["vol"].iloc[-1])
            pct = float(df["pct_chg"].iloc[-1]) if "pct_chg" in df.columns else 0
            if latest_vol > avg_vol * 1.8 and pct > 0:
                tech_score += 10
                signals.append({"name": "放量突破", "type": "bullish", "weight": 10})
            elif latest_vol > avg_vol * 1.8 and pct < 0:
                tech_score -= 8
    except Exception:
        pass

    # Channel
    try:
        channel = detect_channel(df)
        if channel:
            if channel["type"] == "ascending":
                tech_score += 8
                signals.append({"name": "上升通道", "type": "bullish", "weight": 8})
            elif channel["type"] == "descending":
                tech_score -= 8
    except Exception:
        pass

    # H&S patterns
    try:
        if detect_head_and_shoulders(df, is_top=False):
            tech_score += 10
            signals.append({"name": "头肩底形态", "type": "bullish", "weight": 10})
        elif detect_head_and_shoulders(df, is_top=True):
            tech_score -= 10
    except Exception:
        pass

    tech_score = max(0, min(100, tech_score))

    # ── Fundamentals (40 pts total weight) ──────────────────────────────────
    perf = fundamentals.get("performance") or {}
    val = fundamentals.get("valuation") or {}
    inc = fundamentals.get("income") or {}

    # ROE quality
    roe = perf.get("roe")
    if roe is not None:
        if roe >= 20:
            fund_score += 15
            signals.append({"name": f"高ROE({roe:.1f}%)", "type": "bullish", "weight": 15})
        elif roe >= 12:
            fund_score += 8
        elif roe < 0:
            fund_score -= 15

    # Net profit growth
    yoy = perf.get("netprofit_yoy")
    if yoy is not None:
        if yoy >= 30:
            fund_score += 15
            signals.append({"name": f"净利润高增({yoy:.0f}%)", "type": "bullish", "weight": 15})
        elif yoy >= 10:
            fund_score += 8
        elif yoy < -20:
            fund_score -= 12
        elif yoy < 0:
            fund_score -= 5

    # Valuation (PE relative — lower is better for value)
    pe = val.get("pe_ttm")
    if pe is not None and pe > 0:
        if pe < 15:
            fund_score += 8
            signals.append({"name": f"低估值(PE={pe:.1f})", "type": "bullish", "weight": 8})
        elif pe > 60:
            fund_score -= 8

    # Debt safety
    debt = perf.get("debt_to_assets")
    if debt is not None:
        if debt > 80:
            fund_score -= 5
        elif debt < 40:
            fund_score += 3

    fund_score = max(0, min(100, fund_score))

    # Composite: 60% tech + 40% fundamental
    composite = round(tech_score * 0.6 + fund_score * 0.4)

    if composite >= 70:
        recommendation = "强烈看多"
    elif composite >= 60:
        recommendation = "看多"
    elif composite >= 45:
        recommendation = "中性"
    elif composite >= 35:
        recommendation = "看空"
    else:
        recommendation = "强烈看空"

    return {
        "composite": composite,
        "tech_score": tech_score,
        "fund_score": fund_score,
        "recommendation": recommendation,
        "signals": signals,
        # Key metrics for display
        "close": round(float(df["close"].iloc[-1]), 2),
        "pct_chg": round(float(df["pct_chg"].iloc[-1]), 2) if "pct_chg" in df.columns else 0,
        "pe_ttm": val.get("pe_ttm"),
        "roe": roe,
        "netprofit_yoy": yoy,
        "total_mv": val.get("total_mv"),
    }
