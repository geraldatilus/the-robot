import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

log = logging.getLogger(__name__)

# Alpaca IEX feed — wss://stream.data.alpaca.markets/v2/iex
# REST bars also request feed=iex for consistency
DATA_FEED = "iex"


class Broker:
    def __init__(self, api_key: str, secret_key: str, paper: bool = True):
        self._key     = api_key
        self._secret  = secret_key
        self._paper   = paper
        self._trading = None
        self._data    = None

    def _tc(self):
        if not self._trading:
            from alpaca.trading.client import TradingClient
            self._trading = TradingClient(self._key, self._secret, paper=self._paper)
        return self._trading

    def _dc(self):
        if not self._data:
            from alpaca.data.historical import StockHistoricalDataClient
            self._data = StockHistoricalDataClient(self._key, self._secret)
        return self._data

    def reset(self, api_key: str, secret_key: str, paper: bool):
        self._key = api_key
        self._secret = secret_key
        self._paper = paper
        self._trading = None
        self._data = None

    async def _run(self, fn, *args, **kwargs):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))

    async def account(self) -> Dict[str, Any]:
        try:
            a = await self._run(self._tc().get_account)
            return {
                "equity":         float(a.equity),
                "cash":           float(a.cash),
                "buying_power":   float(a.buying_power),
                "daytrade_count": a.daytrade_count,
                "status":         a.status.value,
                "pdt":            a.pattern_day_trader,
            }
        except Exception as e:
            log.error(f"account: {e}")
            return {}

    async def positions(self) -> List[Dict]:
        try:
            ps = await self._run(self._tc().get_all_positions)
            return [{
                "symbol":      p.symbol,
                "qty":         float(p.qty),
                "entry_price": float(p.avg_entry_price),
                "price":       float(p.current_price or 0),
                "pl":          float(p.unrealized_pl or 0),
                "pl_pct":      float(p.unrealized_plpc or 0),
            } for p in ps]
        except Exception as e:
            log.error(f"positions: {e}")
            return []

    async def buy(self, symbol: str, qty: int) -> bool:
        try:
            from alpaca.trading.requests import MarketOrderRequest
            from alpaca.trading.enums import OrderSide, TimeInForce
            req = MarketOrderRequest(symbol=symbol, qty=qty,
                                     side=OrderSide.BUY,
                                     time_in_force=TimeInForce.DAY)
            await self._run(self._tc().submit_order, req)
            return True
        except Exception as e:
            log.error(f"buy {symbol}: {e}")
            return False

    async def sell(self, symbol: str, qty: int) -> bool:
        try:
            from alpaca.trading.requests import MarketOrderRequest
            from alpaca.trading.enums import OrderSide, TimeInForce
            req = MarketOrderRequest(symbol=symbol, qty=qty,
                                     side=OrderSide.SELL,
                                     time_in_force=TimeInForce.DAY)
            await self._run(self._tc().submit_order, req)
            return True
        except Exception as e:
            log.error(f"sell {symbol}: {e}")
            return False

    async def sell_limit(self, symbol: str, qty: int, limit_price: float) -> bool:
        try:
            from alpaca.trading.requests import LimitOrderRequest
            from alpaca.trading.enums import OrderSide, TimeInForce
            req = LimitOrderRequest(
                symbol=symbol, qty=qty,
                limit_price=round(limit_price, 2),
                side=OrderSide.SELL,
                time_in_force=TimeInForce.DAY,
            )
            await self._run(self._tc().submit_order, req)
            return True
        except Exception as e:
            log.error(f"sell_limit {symbol}: {e}")
            return False

    async def close(self, symbol: str) -> bool:
        try:
            await self._run(self._tc().close_position, symbol)
            return True
        except Exception as e:
            log.error(f"close {symbol}: {e}")
            return False

    async def bars(self, symbol: str, tf: str = "1Min", limit: int = 150) -> List[Dict]:
        """
        Fetch bars via Alpaca IEX feed (v2/iex).
        - BarSet items are dicts in alpaca-py 0.43+, not Bar objects
        - IEX REST has ~15-min delay, so end = now-16min
        - 7-day start window covers weekends and holidays
        """
        try:
            from alpaca.data.requests import StockBarsRequest
            from alpaca.data.timeframe import TimeFrame
            from alpaca.data.enums import DataFeed
            from datetime import timezone

            tf_map = {
                "1Min":  TimeFrame.Minute,
                "5Min":  TimeFrame(5,  "Min"),
                "15Min": TimeFrame(15, "Min"),
                "1Hour": TimeFrame.Hour,
                "1Day":  TimeFrame.Day,
            }

            now   = datetime.now(timezone.utc)
            end   = now - timedelta(minutes=16)   # IEX REST ~15-min delay
            start = now - timedelta(days=7)

            from alpaca.common.enums import Sort

            req = StockBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=tf_map.get(tf, TimeFrame.Minute),
                start=start,
                end=end,
                limit=limit,
                feed=DataFeed.IEX,
                sort=Sort.DESC,   # newest first — ensures limit returns most recent bars
            )

            resp = await self._run(self._dc().get_stock_bars, req)

            # alpaca-py 0.43+: resp.data is a dict, items are dicts not Bar objects
            data = resp.data.get(symbol, []) if hasattr(resp, "data") else []

            result = []
            for b in data:
                if isinstance(b, dict):
                    ts  = b.get("timestamp")
                    raw = {
                        "time":   int(ts.timestamp()) if ts else 0,
                        "open":   float(b.get("open",  0)),
                        "high":   float(b.get("high",  0)),
                        "low":    float(b.get("low",   0)),
                        "close":  float(b.get("close", 0)),
                        "volume": float(b.get("volume",0)),
                    }
                else:
                    raw = {
                        "time":   int(b.timestamp.timestamp()),
                        "open":   float(b.open),
                        "high":   float(b.high),
                        "low":    float(b.low),
                        "close":  float(b.close),
                        "volume": float(b.volume),
                    }
                if raw["close"] > 0:
                    result.append(raw)

            # Reverse back to chronological order (ASC) for charts + indicators
            result.reverse()
            return result

        except Exception as e:
            log.error(f"bars {symbol}: {e}")
            return []

    async def latest_quote(self, symbol: str) -> Optional[Dict]:
        """Latest trade price via IEX REST."""
        try:
            from alpaca.data.requests import StockLatestTradeRequest
            from alpaca.data.enums import DataFeed
            req  = StockLatestTradeRequest(symbol_or_symbols=symbol, feed=DataFeed.IEX)
            resp = await self._run(self._dc().get_stock_latest_trade, req)
            data = resp.data if hasattr(resp, "data") else resp
            t    = data.get(symbol) if isinstance(data, dict) else None
            if t:
                ts = t.get("timestamp") if isinstance(t, dict) else getattr(t, "timestamp", None)
                px = t.get("price")     if isinstance(t, dict) else getattr(t, "price", None)
                return {"price": float(px), "time": int(ts.timestamp()) if ts else 0}
            return None
        except Exception as e:
            log.error(f"latest_quote {symbol}: {e}")
            return None
