import numpy as np
import pandas as pd
from typing import Optional
from scipy.signal import argrelextrema


# ---------------------------------------------------------------------------
# Support / Resistance
# ---------------------------------------------------------------------------

def find_support_resistance(df: pd.DataFrame, window: int = 20, num_levels: int = 5) -> dict:
    high = df["high"].values
    low = df["low"].values

    local_max_idx = argrelextrema(high, np.greater_equal, order=window)[0]
    local_min_idx = argrelextrema(low, np.less_equal, order=window)[0]

    resistance_levels = [
        {"price": float(high[i]), "date": df.iloc[i]["trade_date"], "strength": 1}
        for i in local_max_idx
    ]
    support_levels = [
        {"price": float(low[i]), "date": df.iloc[i]["trade_date"], "strength": 1}
        for i in local_min_idx
    ]

    resistance_levels = _cluster_levels(resistance_levels, tolerance=0.02)
    support_levels = _cluster_levels(support_levels, tolerance=0.02)

    resistance_levels.sort(key=lambda x: x["strength"], reverse=True)
    support_levels.sort(key=lambda x: x["strength"], reverse=True)

    return {
        "resistance": resistance_levels[:num_levels],
        "support": support_levels[:num_levels],
    }


def _cluster_levels(levels: list, tolerance: float = 0.02) -> list:
    if not levels:
        return []
    levels.sort(key=lambda x: x["price"])
    clustered = []
    current = levels[0].copy()
    for i in range(1, len(levels)):
        if abs(levels[i]["price"] - current["price"]) / current["price"] < tolerance:
            current["strength"] += 1
            current["price"] = (current["price"] + levels[i]["price"]) / 2
            if levels[i]["date"] > current["date"]:
                current["date"] = levels[i]["date"]
        else:
            clustered.append(current)
            current = levels[i].copy()
    clustered.append(current)
    return clustered


# ---------------------------------------------------------------------------
# Channel — connects actual pivot points, not a blind regression
# ---------------------------------------------------------------------------

def detect_channel(df: pd.DataFrame, window: int = 80) -> Optional[dict]:
    """
    Professional channel detection:
    1. Find swing highs and lows with meaningful order.
    2. Try every pair of swing highs as candidate upper trendline —
       pick the one with no violations and most pivot touches.
    3. For the winning upper line, find the best parallel lower line
       through swing lows with the same scoring criteria.
    4. Validate containment: ≥65% of bars inside the channel.
    """
    if len(df) < window:
        window = max(30, len(df))
    if len(df) < 30:
        return None

    recent = df.tail(window).reset_index(drop=True)
    high = recent["high"].values
    low = recent["low"].values
    close = recent["close"].values
    dates = recent["trade_date"].tolist()
    n = len(recent)
    x = np.arange(n, dtype=float)

    pivot_order = max(5, window // 12)
    min_spacing = window // 5  # pivots must span at least 20% of the window

    sh_idx = argrelextrema(high, np.greater_equal, order=pivot_order)[0]
    sl_idx = argrelextrema(low, np.less_equal, order=pivot_order)[0]

    if len(sh_idx) < 2 or len(sl_idx) < 2:
        return None

    # --- Search for best upper trendline through all pivot-high pairs ---
    best_upper = None
    best_upper_score = -1

    for i in range(len(sh_idx)):
        for j in range(i + 1, len(sh_idx)):
            xi, xj = int(sh_idx[i]), int(sh_idx[j])
            if xj - xi < min_spacing:
                continue
            slope = (high[xj] - high[xi]) / (xj - xi)
            intercept = high[xi] - slope * xi
            line = intercept + slope * x
            # No bar's HIGH may exceed the line (≤1% tolerance)
            if np.any(high > line * 1.01):
                continue
            touches = int(np.sum(high[sh_idx] >= line[sh_idx] * 0.985))
            if touches < 2:
                continue
            score = touches * 10 + (xj - xi)
            if score > best_upper_score:
                best_upper_score = score
                best_upper = (slope, intercept, xi, xj)

    if best_upper is None:
        return None

    upper_slope, upper_intercept, upper_x0, upper_x1 = best_upper
    upper_line = upper_intercept + upper_slope * x

    mid_price = float(np.mean(close))

    # --- Search for best lower trendline through all pivot-low pairs ---
    best_lower = None
    best_lower_score = -1

    for i in range(len(sl_idx)):
        for j in range(i + 1, len(sl_idx)):
            xi, xj = int(sl_idx[i]), int(sl_idx[j])
            if xj - xi < min_spacing:
                continue
            slope = (low[xj] - low[xi]) / (xj - xi)
            intercept = low[xi] - slope * xi
            line = intercept + slope * x
            # No bar's LOW may go below this line
            if np.any(low < line * 0.99):
                continue
            touches = int(np.sum(low[sl_idx] <= line[sl_idx] * 1.015))
            if touches < 2:
                continue
            # Slopes must be roughly parallel
            if abs(slope - upper_slope) > mid_price / window * 1.5:
                continue
            # Lower line must be below upper throughout
            if np.any(upper_line - (intercept + slope * x) <= 0):
                continue
            score = touches * 10 + (xj - xi)
            if score > best_lower_score:
                best_lower_score = score
                best_lower = (slope, intercept, xi, xj)

    if best_lower is None:
        return None

    lower_slope, lower_intercept, lower_x0, lower_x1 = best_lower
    lower_line = lower_intercept + lower_slope * x

    # Validate containment: most bars must be inside the channel
    in_channel = int(np.sum((high <= upper_line * 1.01) & (low >= lower_line * 0.99)))
    if in_channel < n * 0.65:
        return None

    avg_slope = (upper_slope + lower_slope) / 2
    slope_pct = avg_slope / mid_price * 100

    if slope_pct > 0.05:
        channel_type = "ascending"
    elif slope_pct < -0.05:
        channel_type = "descending"
    else:
        channel_type = "horizontal"

    # Extend each line from its first anchor pivot to the last bar
    return {
        "type": channel_type,
        "upper_start": {"date": dates[upper_x0], "price": float(high[upper_x0])},
        "upper_end": {"date": dates[-1], "price": float(upper_intercept + upper_slope * (n - 1))},
        "lower_start": {"date": dates[lower_x0], "price": float(low[lower_x0])},
        "lower_end": {"date": dates[-1], "price": float(lower_intercept + lower_slope * (n - 1))},
        "slope": float(avg_slope),
    }


# ---------------------------------------------------------------------------
# Box (Rectangle) — requires genuine boundary tests, not global max/min
# ---------------------------------------------------------------------------

def detect_box(df: pd.DataFrame, window: int = 60, tolerance: float = 0.015) -> Optional[dict]:
    """
    Professional box detection:
    1. Find clear upper resistance and lower support within the window.
    2. Require at least 2 clear tests on each boundary.
    3. Ensure price spends most of the time inside the box.
    4. Reject if price is trending (not ranging).
    """
    if len(df) < 20:
        return None
    window = min(window, len(df))
    recent = df.tail(window).reset_index(drop=True)
    high = recent["high"].values
    low = recent["low"].values
    close = recent["close"].values
    dates = recent["trade_date"].tolist()
    n = len(recent)

    # Find local pivot highs and lows
    pivot_order = max(3, window // 15)
    ph_idx = argrelextrema(high, np.greater_equal, order=pivot_order)[0]
    pl_idx = argrelextrema(low, np.less_equal, order=pivot_order)[0]

    if len(ph_idx) < 2 or len(pl_idx) < 2:
        return None

    ph_prices = high[ph_idx]
    pl_prices = low[pl_idx]

    # Cluster pivot highs to find resistance zone
    ph_sorted = np.sort(ph_prices)[::-1]
    # Take the top-N pivot highs and cluster them
    upper_zone = _find_dense_zone(ph_prices, tolerance=0.025)
    lower_zone = _find_dense_zone(pl_prices, tolerance=0.025, highest=False)

    if upper_zone is None or lower_zone is None:
        return None

    upper = upper_zone
    lower = lower_zone

    if upper <= lower:
        return None

    mid = (upper + lower) / 2
    box_range = (upper - lower) / mid

    # Box should be a meaningful range (1%–25%)
    if box_range < 0.02 or box_range > 0.25:
        return None

    # Count clean touches on each boundary
    touches_upper = int(np.sum(high >= upper * (1 - tolerance * 2)))
    touches_lower = int(np.sum(low <= lower * (1 + tolerance * 2)))

    if touches_upper < 2 or touches_lower < 2:
        return None

    # Most price action should be within the box
    inside = np.sum((close >= lower * (1 - tolerance)) & (close <= upper * (1 + tolerance)))
    if inside < n * 0.70:
        return None

    # Reject trending price — regression slope should be small
    slope = np.polyfit(np.arange(n, dtype=float), close, 1)[0]
    if abs(slope) / mid > 0.002:
        return None

    return {
        "type": "box",
        "upper": float(upper),
        "lower": float(lower),
        "start_date": dates[0],
        "end_date": dates[-1],
        "touches_upper": touches_upper,
        "touches_lower": touches_lower,
    }


def _find_dense_zone(prices: np.ndarray, tolerance: float = 0.025, highest: bool = True) -> Optional[float]:
    """Find the most densely-clustered price zone among a list of pivot prices."""
    if len(prices) == 0:
        return None

    best_center = None
    best_count = 0

    for p in prices:
        lo = p * (1 - tolerance)
        hi = p * (1 + tolerance)
        count = np.sum((prices >= lo) & (prices <= hi))
        if count > best_count:
            best_count = count
            best_center = float(np.mean(prices[(prices >= lo) & (prices <= hi)]))

    if best_center is None or best_count < 2:
        # No dense cluster — just use the extreme value
        best_center = float(np.max(prices)) if highest else float(np.min(prices))

    return best_center


# ---------------------------------------------------------------------------
# Head and Shoulders — professional-grade with proper neckline
# ---------------------------------------------------------------------------

def detect_head_and_shoulders(df: pd.DataFrame, window: int = 120, is_top: bool = True) -> Optional[dict]:
    """
    Professional H&S detection:
    - Head must be distinctly higher/lower than both shoulders (≥3%).
    - Shoulders can differ by up to 20% of head prominence.
    - Neckline endpoints are the actual trough dates between pivots.
    - Pattern must be reasonably recent (not buried in old data).
    """
    if len(df) < 40:
        return None
    window = min(window, len(df))
    recent = df.tail(window).reset_index(drop=True)

    if is_top:
        pivot_prices = recent["high"].values
        trough_prices = recent["low"].values
    else:
        pivot_prices = recent["low"].values
        trough_prices = recent["high"].values

    dates = recent["trade_date"].tolist()
    n = len(recent)

    order = max(5, window // 15)

    if is_top:
        pivot_idx = argrelextrema(pivot_prices, np.greater_equal, order=order)[0]
    else:
        pivot_idx = argrelextrema(pivot_prices, np.less_equal, order=order)[0]

    if len(pivot_idx) < 3:
        return None

    best_pattern = None
    best_prominence = 0.0

    for i in range(len(pivot_idx) - 2):
        ls_i = pivot_idx[i]    # left shoulder index
        h_i = pivot_idx[i + 1] # head index
        rs_i = pivot_idx[i + 2] # right shoulder index

        ls_p = float(pivot_prices[ls_i])
        h_p = float(pivot_prices[h_i])
        rs_p = float(pivot_prices[rs_i])

        # Head must be the highest peak (top) or lowest trough (bottom)
        if is_top:
            if h_p <= ls_p or h_p <= rs_p:
                continue
            prominence_ls = (h_p - ls_p) / h_p
            prominence_rs = (h_p - rs_p) / h_p
        else:
            if h_p >= ls_p or h_p >= rs_p:
                continue
            prominence_ls = (ls_p - h_p) / ls_p
            prominence_rs = (rs_p - h_p) / rs_p

        # Head must be at least 3% more prominent than each shoulder
        if prominence_ls < 0.03 or prominence_rs < 0.03:
            continue

        # Shoulders should be roughly symmetric (within 20% of head prominence)
        if is_top:
            shoulder_diff = abs(ls_p - rs_p) / h_p
        else:
            shoulder_diff = abs(ls_p - rs_p) / h_p

        if shoulder_diff > 0.20:
            continue

        # Find the actual trough between left shoulder and head
        left_trough_range = trough_prices[ls_i:h_i + 1]
        right_trough_range = trough_prices[h_i:rs_i + 1]

        if len(left_trough_range) < 2 or len(right_trough_range) < 2:
            continue

        if is_top:
            lt_local_idx = int(np.argmin(left_trough_range))
            rt_local_idx = int(np.argmin(right_trough_range))
            neckline_left_price = float(np.min(left_trough_range))
            neckline_right_price = float(np.min(right_trough_range))
        else:
            lt_local_idx = int(np.argmax(left_trough_range))
            rt_local_idx = int(np.argmax(right_trough_range))
            neckline_left_price = float(np.max(left_trough_range))
            neckline_right_price = float(np.max(right_trough_range))

        neckline_left_date = dates[ls_i + lt_local_idx]
        neckline_right_date = dates[h_i + rt_local_idx]

        # Prefer patterns with higher prominence (more significant pattern)
        total_prominence = prominence_ls + prominence_rs
        if total_prominence > best_prominence:
            best_prominence = total_prominence
            best_pattern = {
                "type": "head_shoulders_top" if is_top else "head_shoulders_bottom",
                "left_shoulder": {"date": dates[ls_i], "price": ls_p},
                "head": {"date": dates[h_i], "price": h_p},
                "right_shoulder": {"date": dates[rs_i], "price": rs_p},
                "neckline_start": {"date": neckline_left_date, "price": neckline_left_price},
                "neckline_end": {"date": neckline_right_date, "price": neckline_right_price},
            }

    return best_pattern


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def detect_all_patterns(df: pd.DataFrame) -> dict:
    results: dict = {}

    sr = find_support_resistance(df)
    results["support_resistance"] = sr

    channel = detect_channel(df)
    if channel:
        results["channel"] = channel

    box = detect_box(df)
    if box:
        results["box"] = box

    hs_top = detect_head_and_shoulders(df, is_top=True)
    if hs_top:
        results["head_shoulders_top"] = hs_top

    hs_bottom = detect_head_and_shoulders(df, is_top=False)
    if hs_bottom:
        results["head_shoulders_bottom"] = hs_bottom

    return results
