# The RoBot — Algorithmic Trading Station

A production-grade automated trading system built on the Alpaca Markets API with a real-time React dashboard.

## Stack

| Layer | Tech |
|---|---|
| Backend | Python · FastAPI · asyncio |
| Data | Alpaca IEX Stream (`v2/iex`) + REST polling |
| Frontend | React · Vite · Tailwind CSS |
| Charts | TradingView Lightweight Charts |
| Config | YAML — fully editable via UI |

## Features

- **Live Scan Feed** — EMA cross · VWAP · RSI · Relative Volume gate system
- **24/7 scanning** — IEX stream during market hours, REST polling outside
- **Watchlist** — add/remove tickers, bulk-import S&P 500 / NASDAQ 100 / Dow 30 / ETFs
- **Charts** — live 1-min candles with Entry / Stop / T1/T2/T3 / Current Price lines
- **Strategy Editor** — edit all parameters via YAML in the browser
- **Risk management** — daily loss kill switch, position sizing, partial exits at ATR targets
- **Trailing stop** — activates after N consecutive green candles, ratchets with EMA 9

## Setup

```bash
# 1. Copy and fill in your Alpaca credentials
cp backend/config/config.example.yaml backend/config/config.yaml

# 2. Launch (auto-installs everything on first run)
start.bat          # Windows — double-click or run from terminal
```

Then open **http://localhost:8080**

## Strategy Logic

**Entry:** Price > VWAP · EMA9 > EMA21 (+0.1% buffer) · RSI 50–70 · RVOL ≥ 1.5×

**Exit:**
- Sell ⅓ at +1.5× ATR
- Sell ⅓ at +3.0× ATR
- Trail remainder: locks at low of 3rd consecutive green candle, ratchets with EMA 9

**Risk:** 1% equity per trade · 15% max position · 3% daily loss kill switch
