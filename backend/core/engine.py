"""
Trading engine — runs 24/7.
Stream handles live market-hours bars. Polling loop covers pre-market,
after-hours, weekends, and any stream gaps.
"""
import asyncio
import logging
import threading
from datetime import datetime, date
from typing import Dict, List, Any, Optional, Callable

from .config     import load, save
from .broker     import Broker
from .strategy   import check_entry, EntrySignal
from .indicators import ema

log = logging.getLogger(__name__)

POLL_INTERVAL   = 45   # seconds between full poll cycles
POLL_SYM_DELAY  = 0.8  # seconds between each symbol during polling


# ── Position ──────────────────────────────────────────────────────────────────

class Position:
    def __init__(self, sig: EntrySignal):
        self.symbol       = sig.symbol
        self.entry        = sig.entry_price
        self.stop         = sig.stop_price
        self.t1           = sig.target_1
        self.t2           = sig.target_2
        self.t3           = sig.target_3
        self.atr          = sig.atr_val
        self.qty          = sig.qty
        self.qty_left     = sig.qty
        self.price        = sig.entry_price
        self.trail_active = False
        self.t1_done      = False
        self.t2_done      = False
        self.opens        = datetime.utcnow()
        self.bars: List[Dict] = []
        self.green_streak = 0

    @property
    def pl(self) -> float:
        return (self.price - self.entry) * self.qty_left

    @property
    def pl_pct(self) -> float:
        return ((self.price - self.entry) / self.entry * 100) if self.entry else 0

    def to_dict(self) -> Dict:
        return {
            "symbol":        self.symbol,
            "entry_price":   round(self.entry, 4),
            "current_price": round(self.price, 4),
            "stop_price":    round(self.stop, 4),
            "target_1":      round(self.t1, 4) if self.t1 else None,
            "target_2":      round(self.t2, 4) if self.t2 else None,
            "target_3":      round(self.t3, 4) if self.t3 else None,
            "qty":           self.qty,
            "qty_left":      self.qty_left,
            "pl":            round(self.pl, 2),
            "pl_pct":        round(self.pl_pct, 3),
            "trail_active":  self.trail_active,
            "t1_done":       self.t1_done,
            "t2_done":       self.t2_done,
            "open_since":    self.opens.isoformat(),
        }


# ── Engine ────────────────────────────────────────────────────────────────────

class Engine:
    def __init__(self):
        self.state         = "STOPPED"
        self.scan_mode     = "IDLE"      # STREAMING | POLLING | IDLE
        self.cfg: Dict     = {}
        self.broker: Optional[Broker]          = None
        self.positions: Dict[str, Position]    = {}
        self.scan_results: Dict[str, Dict]     = {}
        self.bar_buffers:  Dict[str, List]     = {}   # persistent across poll cycles
        self.trade_log: List[Dict]             = []
        self.daily_pnl     = 0.0
        self.pnl_date      = date.today()
        self.current_scan  = ""
        self.start_time: Optional[datetime]    = None
        self._broadcast_fn: Optional[Callable] = None
        self._stream_thread: Optional[threading.Thread] = None
        self._poll_task: Optional[asyncio.Task]         = None
        self._monitor_task: Optional[asyncio.Task]      = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self.last_error    = ""
        self._last_stream_bar = datetime.utcnow()

    def set_broadcast(self, fn: Callable):
        self._broadcast_fn = fn

    def _emit(self, kind: str, data: Any):
        if not self._broadcast_fn or not self._loop:
            return
        msg = {"type": kind, "data": data, "ts": datetime.utcnow().isoformat()}
        asyncio.run_coroutine_threadsafe(self._broadcast_fn(msg), self._loop)

    # ── lifecycle ─────────────────────────────────────────────────────────────

    async def init(self):
        self._loop = asyncio.get_event_loop()
        self.cfg   = load()
        a = self.cfg.get("alpaca", {})
        self.broker = Broker(a.get("api_key",""), a.get("secret_key",""), a.get("paper", True))
        log.info("Engine initialised")

    async def start(self):
        if self.state == "RUNNING":
            return
        if not self.broker:
            await self.init()
        self.state      = "RUNNING"
        self.scan_mode  = "POLLING"
        self.start_time = datetime.utcnow()

        # Start both — stream fires when market is open, poll runs always
        self._start_stream()
        self._poll_task    = asyncio.create_task(self._poll_worker())
        self._monitor_task = asyncio.create_task(self._monitor())

        self._emit("engine_state", {"state": self.state, "scan_mode": self.scan_mode})
        log.info("Engine started (stream + 24/7 polling)")

    async def stop(self):
        self.state     = "STOPPED"
        self.scan_mode = "IDLE"
        self._stop_stream()
        for task in (self._poll_task, self._monitor_task):
            if task:
                task.cancel()
        self._emit("engine_state", {"state": self.state})
        log.info("Engine stopped")

    async def reload(self):
        self.cfg = load()
        if self.broker:
            a = self.cfg.get("alpaca", {})
            self.broker.reset(a.get("api_key",""), a.get("secret_key",""), a.get("paper", True))
        self._emit("config_reloaded", {})

    # ── stream worker (market hours live bars) ────────────────────────────────

    def _start_stream(self):
        self._stream_thread = threading.Thread(target=self._stream_worker, daemon=True)
        self._stream_thread.start()

    def _stop_stream(self):
        client = getattr(self, "_stream_client", None)
        if client:
            try:
                client.stop()
            except Exception:
                pass

    def _stream_worker(self):
        """
        Connects to wss://stream.data.alpaca.markets/v2/iex
        IEX (Investors Exchange) — real-time bars during market hours.
        Polling loop covers everything outside market hours.
        """
        import time
        from alpaca.data.live import StockDataStream
        delay = 10
        while self.state == "RUNNING":
            try:
                a           = self.cfg.get("alpaca", {})
                key, secret = a.get("api_key",""), a.get("secret_key","")
                symbols     = self.cfg.get("scanner", {}).get("universe", [])
                if not key or not secret or not symbols:
                    time.sleep(30)
                    continue

                # IEX feed — must pass the DataFeed enum (stream calls .value internally)
                from alpaca.data.enums import DataFeed
                self._stream_client = StockDataStream(
                    key, secret,
                    feed=DataFeed.IEX,   # wss://stream.data.alpaca.markets/v2/iex
                )
                self._stream_client.subscribe_bars(self._on_stream_bar, *symbols)
                log.info(f"Stream connecting: wss://stream.data.alpaca.markets/v2/iex "
                         f"({len(symbols)} symbols)")
                self.last_error = ""
                self.scan_mode  = "STREAMING"
                self._emit("engine_state", {"state": self.state, "scan_mode": "STREAMING"})
                self._stream_client.run()   # blocks until disconnected / market close

            except Exception as e:
                self.last_error = str(e)
                log.warning(f"IEX stream: {e} — polling active, retrying in {delay}s")
                self._emit("engine_state", {"state": self.state,
                                            "scan_mode": "POLLING", "error": str(e)})

            if self.state == "RUNNING":
                self.scan_mode = "POLLING"
                time.sleep(delay)
                delay = min(delay * 2, 120)

    def _on_stream_bar(self, bar):
        self._last_stream_bar = datetime.utcnow()
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self._process_symbol_bar(
                    bar.symbol,
                    {"time":   int(bar.timestamp.timestamp()),
                     "open":   float(bar.open), "high": float(bar.high),
                     "low":    float(bar.low),  "close": float(bar.close),
                     "volume": float(bar.volume)},
                    source="stream",
                ),
                self._loop,
            )

    # ── 24/7 polling worker ───────────────────────────────────────────────────

    async def _poll_worker(self):
        """
        Fetches recent bars for every symbol on a fixed interval.
        Runs regardless of market hours — covers pre-market, after-hours,
        weekends, and stream outages.
        """
        # brief startup delay so stream gets first shot during market hours
        await asyncio.sleep(15)

        while self.state == "RUNNING":
            symbols = self.cfg.get("scanner", {}).get("universe", [])
            if not symbols:
                await asyncio.sleep(POLL_INTERVAL)
                continue

            log.info(f"Poll cycle — {len(symbols)} symbols")
            for sym in symbols:
                if self.state != "RUNNING":
                    return
                try:
                    self.current_scan = sym
                    self._emit("scan_progress", {"symbol": sym, "mode": "poll"})

                    bars = await self.broker.bars(sym, "1Min", 100)
                    if bars:
                        # merge into persistent buffer (avoid duplicate timestamps)
                        buf = self.bar_buffers.setdefault(sym, [])
                        existing_times = {b["time"] for b in buf}
                        for b in bars:
                            if b["time"] not in existing_times:
                                buf.append(b)
                                existing_times.add(b["time"])
                        buf.sort(key=lambda x: x["time"])
                        if len(buf) > 200:
                            self.bar_buffers[sym] = buf[-200:]

                        await self._evaluate_symbol(sym, self.bar_buffers[sym], source="poll")
                except Exception as e:
                    log.error(f"Poll {sym}: {e}")

                await asyncio.sleep(POLL_SYM_DELAY)

            await asyncio.sleep(POLL_INTERVAL)

    # ── core evaluation (shared by stream and poll) ───────────────────────────

    async def _process_symbol_bar(self, symbol: str, bar: Dict, source: str):
        """Called per-bar from the stream."""
        self.current_scan = symbol
        buf = self.bar_buffers.setdefault(symbol, [])
        if not buf or buf[-1]["time"] != bar["time"]:
            buf.append(bar)
        if len(buf) > 200:
            buf.pop(0)
        await self._evaluate_symbol(symbol, buf, source=source)
        if symbol in self.positions:
            await self._manage_position(symbol, bar)

    async def _evaluate_symbol(self, symbol: str, bars: List[Dict], source: str):
        if not bars:
            return
        acct   = await self.broker.account()
        equity = acct.get("equity", 100_000)
        sig    = check_entry(symbol, bars, equity, self.cfg)

        result = {
            "symbol":      symbol,
            "status":      "PASSED" if sig.passed else "FAILED",
            "timestamp":   datetime.utcnow().isoformat(),
            "reasoning":   sig.reasoning,
            "source":      source,
            "gates":       [{"name": g.name, "status": g.status, "detail": g.detail}
                            for g in sig.gates],
            "entry_price": sig.entry_price,
            "stop_price":  sig.stop_price,
            "target_1":    sig.target_1,
            "target_2":    sig.target_2,
            "target_3":    sig.target_3,
            "qty":         sig.qty,
            "bars":        bars,
        }
        self.scan_results[symbol] = result
        self._emit("scan_update", {k: v for k, v in result.items() if k != "bars"})

        if sig.passed and self.state == "RUNNING" and source in ("stream", "poll"):
            await self._try_open(sig)

    # ── position management ───────────────────────────────────────────────────

    async def _try_open(self, sig: EntrySignal):
        if sig.symbol in self.positions:
            return
        if len(self.positions) >= self.cfg.get("risk", {}).get("max_open_positions", 5):
            return
        if self.state == "KILL_SWITCH":
            return
        if await self.broker.buy(sig.symbol, sig.qty):
            self.positions[sig.symbol] = Position(sig)
            self._emit("position_update", self.positions[sig.symbol].to_dict())
            log.info(f"Opened {sig.symbol} x{sig.qty} @ {sig.entry_price:.2f}")

    async def _manage_position(self, symbol: str, bar: Dict):
        pos = self.positions.get(symbol)
        if not pos:
            return
        pos.price = bar["close"]
        pos.bars.append(bar)
        closes = [b["close"] for b in pos.bars]

        t1q = pos.qty // 3
        if not pos.t1_done and pos.t1 and bar["high"] >= pos.t1 and pos.qty_left > t1q:
            await self.broker.sell(symbol, t1q)
            pos.qty_left -= t1q; pos.t1_done = True
            log.info(f"T1 hit {symbol}")

        t2q = pos.qty // 3
        if not pos.t2_done and pos.t2 and bar["high"] >= pos.t2 and pos.qty_left > t2q:
            await self.broker.sell(symbol, t2q)
            pos.qty_left -= t2q; pos.t2_done = True
            log.info(f"T2 hit {symbol}")

        if len(pos.bars) >= 2:
            pos.green_streak = (pos.green_streak + 1) if bar["close"] > pos.bars[-2]["close"] else 0

        trigger = self.cfg.get("strategy", {}).get("trailing_trigger_candles", 3)
        if not pos.trail_active and pos.green_streak >= trigger:
            pos.trail_active = True
            pos.stop         = bar["low"]

        if pos.trail_active and len(closes) >= 9:
            e9 = ema(closes, 9)
            if e9:
                pos.stop = max(pos.stop, e9)

        if bar["close"] <= pos.stop:
            await self._close_position(symbol, "stop")
            return

        self._emit("position_update", pos.to_dict())

    async def _close_position(self, symbol: str, reason: str = "manual"):
        if symbol not in self.positions:
            return
        pos = self.positions[symbol]
        await self.broker.close(symbol)
        realized = (pos.price - pos.entry) * pos.qty_left
        self.daily_pnl += realized
        record = {"symbol": symbol, "entry": pos.entry, "exit": pos.price,
                  "qty": pos.qty_left, "pl": round(realized, 2),
                  "reason": reason, "timestamp": datetime.utcnow().isoformat()}
        self.trade_log.append(record)
        del self.positions[symbol]
        self._emit("trade_closed", record)

    # ── monitor ───────────────────────────────────────────────────────────────

    async def _monitor(self):
        while self.state in ("RUNNING", "KILL_SWITCH"):
            try:
                if date.today() != self.pnl_date:
                    self.daily_pnl = 0; self.pnl_date = date.today()
                acct   = await self.broker.account()
                equity = acct.get("equity", 0)
                limit  = equity * self.cfg.get("risk", {}).get("daily_loss_limit_pct", 0.03)
                if self.state == "RUNNING" and self.daily_pnl < -limit:
                    self.state = "KILL_SWITCH"
                    self._emit("engine_state", {"state": "KILL_SWITCH"})
                self._emit("account_update", acct)
                self._emit("positions_update", [p.to_dict() for p in self.positions.values()])
            except Exception as e:
                log.error(f"monitor: {e}")
            await asyncio.sleep(5)

    # ── public ────────────────────────────────────────────────────────────────

    def status(self) -> Dict:
        return {
            "state":        self.state,
            "scan_mode":    self.scan_mode,
            "start_time":   self.start_time.isoformat() if self.start_time else None,
            "daily_pnl":    round(self.daily_pnl, 2),
            "positions":    [p.to_dict() for p in self.positions.values()],
            "scan_results": [{k: v for k, v in r.items() if k != "bars"}
                             for r in self.scan_results.values()],
            "current_scan": self.current_scan,
            "trade_count":  len(self.trade_log),
            "last_error":   self.last_error,
        }


# ── Singleton ─────────────────────────────────────────────────────────────────
engine = Engine()
