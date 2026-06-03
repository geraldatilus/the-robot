from typing import List, Optional
import numpy as np


def ema(values: List[float], period: int) -> Optional[float]:
    if len(values) < period:
        return None
    k = 2.0 / (period + 1)
    val = float(np.mean(values[:period]))
    for v in values[period:]:
        val = v * k + val * (1 - k)
    return val


def rsi(closes: List[float], period: int = 14) -> Optional[float]:
    if len(closes) < period + 1:
        return None
    d = np.diff(closes[-period - 1:])
    gain = float(np.mean(np.where(d > 0, d, 0)))
    loss = float(np.mean(np.where(d < 0, -d, 0)))
    if loss == 0:
        return 100.0
    return 100.0 - 100.0 / (1 + gain / loss)


def atr(highs: List[float], lows: List[float], closes: List[float], period: int = 14) -> Optional[float]:
    if len(closes) < period + 1:
        return None
    trs = [max(highs[i] - lows[i], abs(highs[i] - closes[i-1]), abs(lows[i] - closes[i-1]))
           for i in range(1, len(closes))]
    return float(np.mean(trs[-period:]))


def vwap(highs: List[float], lows: List[float], closes: List[float], volumes: List[float]) -> Optional[float]:
    if not volumes or sum(volumes) == 0:
        return None
    tp = [(h + l + c) / 3 for h, l, c in zip(highs, lows, closes)]
    return sum(t * v for t, v in zip(tp, volumes)) / sum(volumes)


def rvol(current: float, history: List[float]) -> float:
    avg = float(np.mean(history)) if history else 0
    return current / avg if avg > 0 else 0.0
