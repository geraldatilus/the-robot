from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum
from .indicators import ema, rsi, atr, vwap, rvol


class GateStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"


@dataclass
class Gate:
    name: str
    status: GateStatus
    detail: str


@dataclass
class EntrySignal:
    symbol: str
    passed: bool
    gates: List[Gate] = field(default_factory=list)
    entry_price: Optional[float] = None
    stop_price: Optional[float] = None
    target_1: Optional[float] = None
    target_2: Optional[float] = None
    target_3: Optional[float] = None
    atr_val: Optional[float] = None
    qty: int = 0
    reasoning: str = ""


def check_entry(symbol: str, bars: List[Dict], equity: float, cfg: Dict[str, Any]) -> EntrySignal:
    if len(bars) < 30:
        return EntrySignal(symbol=symbol, passed=False, reasoning="Not enough bars")

    closes  = [b["close"]  for b in bars]
    highs   = [b["high"]   for b in bars]
    lows    = [b["low"]    for b in bars]
    volumes = [b["volume"] for b in bars]
    price   = closes[-1]

    s = cfg.get("strategy", {})
    r = cfg.get("risk", {})
    gates: List[Gate] = []

    # Gate 1 — Price > VWAP
    vw = vwap(highs, lows, closes, volumes)
    if vw:
        ok = price > vw
        gates.append(Gate("Price > VWAP", GateStatus.PASS if ok else GateStatus.FAIL,
                          f"Price {price:.2f} vs VWAP {vw:.2f}"))
    else:
        gates.append(Gate("Price > VWAP", GateStatus.FAIL, "VWAP unavailable"))

    # Gate 2 — EMA cross
    fast_p = s.get("ema_fast", 9)
    slow_p = s.get("ema_slow", 21)
    buf    = s.get("ema_buffer_pct", 0.001)
    ef = ema(closes, fast_p)
    es = ema(closes, slow_p)
    if ef and es:
        ok = ef > es * (1 + buf)
        gates.append(Gate(f"EMA{fast_p} > EMA{slow_p}", GateStatus.PASS if ok else GateStatus.FAIL,
                          f"EMA{fast_p}={ef:.3f} EMA{slow_p}={es:.3f}"))
    else:
        gates.append(Gate("EMA Cross", GateStatus.FAIL, "Insufficient data"))

    # Gate 3 — RSI
    rv = rsi(closes)
    rmin, rmax = s.get("rsi_min", 50), s.get("rsi_max", 70)
    if rv:
        ok = rmin <= rv <= rmax
        gates.append(Gate(f"RSI [{rmin}-{rmax}]", GateStatus.PASS if ok else GateStatus.FAIL,
                          f"RSI={rv:.1f}"))
    else:
        gates.append(Gate("RSI", GateStatus.FAIL, "Insufficient data"))

    # Gate 4 — Relative Volume
    min_rvol = s.get("min_relative_volume", 1.5)
    rv2 = rvol(volumes[-1], volumes[:-1])
    ok = rv2 >= min_rvol
    gates.append(Gate(f"RVOL >= {min_rvol}x", GateStatus.PASS if ok else GateStatus.FAIL,
                      f"RVOL={rv2:.2f}x"))

    atr_val = atr(highs, lows, closes, s.get("atr_period", 14))
    if not atr_val:
        return EntrySignal(symbol=symbol, passed=False, reasoning="No ATR", gates=gates)

    passed = all(g.status == GateStatus.PASS for g in gates)

    if not passed:
        failed = [g.name for g in gates if g.status == GateStatus.FAIL]
        return EntrySignal(symbol=symbol, passed=False, gates=gates,
                           reasoning=f"Failed: {', '.join(failed)}")

    stop  = price - atr_val
    t1    = price + atr_val * s.get("take_profit_atr_1", 1.5)
    t2    = price + atr_val * s.get("take_profit_atr_2", 3.0)
    t3    = price + atr_val * s.get("take_profit_atr_3", 5.0)
    risk  = equity * r.get("risk_per_trade_pct", 0.01)
    rps   = max(price - stop, 0.01)
    qty   = min(int(risk / rps), int(equity * r.get("max_position_pct", 0.15) / price))

    return EntrySignal(
        symbol=symbol, passed=True, gates=gates,
        entry_price=price, stop_price=stop,
        target_1=t1, target_2=t2, target_3=t3,
        atr_val=atr_val, qty=max(qty, 1),
        reasoning=f"All gates passed — Entry {price:.2f} Stop {stop:.2f}",
    )
