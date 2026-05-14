import numpy as np
import pandas as pd
from typing import Optional


def calc_ma(close: pd.Series, period: int) -> pd.Series:
    return close.rolling(window=period, min_periods=1).mean()


def calc_ema(close: pd.Series, period: int) -> pd.Series:
    return close.ewm(span=period, adjust=False).mean()


def calc_macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> dict:
    ema_fast = calc_ema(close, fast)
    ema_slow = calc_ema(close, slow)
    dif = ema_fast - ema_slow
    dea = calc_ema(dif, signal)
    macd = (dif - dea) * 2
    return {"dif": dif, "dea": dea, "macd": macd}


def calc_kdj(high: pd.Series, low: pd.Series, close: pd.Series, n: int = 9, m1: int = 3, m2: int = 3) -> dict:
    lowest = low.rolling(window=n, min_periods=1).min()
    highest = high.rolling(window=n, min_periods=1).max()
    rsv = (close - lowest) / (highest - lowest + 1e-10) * 100

    k = pd.Series(np.zeros(len(close)), index=close.index)
    d = pd.Series(np.zeros(len(close)), index=close.index)

    k.iloc[0] = 50
    d.iloc[0] = 50

    for i in range(1, len(close)):
        k.iloc[i] = (m1 - 1) / m1 * k.iloc[i - 1] + 1 / m1 * rsv.iloc[i]
        d.iloc[i] = (m2 - 1) / m2 * d.iloc[i - 1] + 1 / m2 * k.iloc[i]

    j = 3 * k - 2 * d
    return {"k": k, "d": d, "j": j}


def calc_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.where(delta > 0, 0)
    loss = (-delta).where(delta < 0, 0)
    avg_gain = gain.rolling(window=period, min_periods=1).mean()
    avg_loss = loss.rolling(window=period, min_periods=1).mean()
    rs = avg_gain / (avg_loss + 1e-10)
    return 100 - (100 / (1 + rs))


def calc_boll(close: pd.Series, period: int = 20, std_dev: float = 2.0) -> dict:
    mid = close.rolling(window=period, min_periods=1).mean()
    std = close.rolling(window=period, min_periods=1).std()
    upper = mid + std_dev * std
    lower = mid - std_dev * std
    return {"upper": upper, "mid": mid, "lower": lower}


def calc_wr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    highest = high.rolling(window=period, min_periods=1).max()
    lowest = low.rolling(window=period, min_periods=1).min()
    return (highest - close) / (highest - lowest + 1e-10) * -100


def calc_dmi(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> dict:
    up_move = high.diff()
    down_move = -low.diff()

    plus_dm = pd.Series(np.where((up_move > down_move) & (up_move > 0), up_move, 0), index=close.index)
    minus_dm = pd.Series(np.where((down_move > up_move) & (down_move > 0), down_move, 0), index=close.index)

    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    atr = tr.rolling(window=period, min_periods=1).mean()
    plus_di = 100 * plus_dm.rolling(window=period, min_periods=1).mean() / (atr + 1e-10)
    minus_di = 100 * minus_dm.rolling(window=period, min_periods=1).mean() / (atr + 1e-10)
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di + 1e-10)
    adx = dx.rolling(window=period, min_periods=1).mean()

    return {"pdi": plus_di, "mdi": minus_di, "adx": adx}


def calc_obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    direction = np.sign(close.diff())
    direction.iloc[0] = 0
    return (volume * direction).cumsum()


def calc_all_indicators(df: pd.DataFrame) -> dict:
    close = df["close"]
    high = df["high"]
    low = df["low"]
    vol = df["vol"]

    result = {}
    for p in [5, 10, 20, 30, 60]:
        result[f"ma{p}"] = calc_ma(close, p).tolist()

    macd = calc_macd(close)
    result["dif"] = macd["dif"].tolist()
    result["dea"] = macd["dea"].tolist()
    result["macd"] = macd["macd"].tolist()

    kdj = calc_kdj(high, low, close)
    result["k"] = kdj["k"].tolist()
    result["d"] = kdj["d"].tolist()
    result["j"] = kdj["j"].tolist()

    result["rsi6"] = calc_rsi(close, 6).tolist()
    result["rsi12"] = calc_rsi(close, 12).tolist()
    result["rsi24"] = calc_rsi(close, 24).tolist()

    boll = calc_boll(close)
    result["boll_upper"] = boll["upper"].tolist()
    result["boll_mid"] = boll["mid"].tolist()
    result["boll_lower"] = boll["lower"].tolist()

    result["wr6"] = calc_wr(high, low, close, 6).tolist()
    result["wr10"] = calc_wr(high, low, close, 10).tolist()

    dmi = calc_dmi(high, low, close)
    result["pdi"] = dmi["pdi"].tolist()
    result["mdi"] = dmi["mdi"].tolist()
    result["adx"] = dmi["adx"].tolist()

    result["obv"] = calc_obv(close, vol).tolist()

    for key in result:
        result[key] = [None if (isinstance(v, float) and np.isnan(v)) else round(v, 4) if isinstance(v, float) else v for v in result[key]]

    return result
