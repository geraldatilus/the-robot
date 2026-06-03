from fastapi import APIRouter, HTTPException
from typing import Any, Dict
from core.engine import engine
from core.config import load, save
from core.markets import SP500, NASDAQ100, DOW30, BROAD_ETFS, SECTOR_ETFS, GROUPS

router = APIRouter(prefix="/api")


@router.get("/status")
async def get_status():
    return engine.status()


@router.post("/engine/start")
async def start():
    await engine.start()
    return {"state": engine.state}


@router.post("/engine/stop")
async def stop():
    await engine.stop()
    return {"state": engine.state}


@router.get("/config")
async def get_config():
    return load()


@router.post("/config")
async def post_config(body: Dict[str, Any]):
    save(body)
    await engine.reload()
    return {"ok": True}


@router.get("/account")
async def get_account():
    if not engine.broker:
        raise HTTPException(503, "Engine not ready")
    return await engine.broker.account()


@router.get("/positions")
async def get_positions():
    if not engine.broker:
        return []
    return await engine.broker.positions()


@router.delete("/positions/{symbol}")
async def close_position(symbol: str):
    await engine._close_position(symbol.upper(), "manual")
    return {"ok": True}


@router.get("/charts/{symbol}")
async def get_chart(symbol: str, timeframe: str = "1Min", limit: int = 150):
    if not engine.broker:
        raise HTTPException(503, "Engine not ready")
    bars = await engine.broker.bars(symbol.upper(), timeframe, limit)
    pos  = engine.positions.get(symbol.upper())
    return {"bars": bars, "position": pos.to_dict() if pos else None}


@router.get("/trades")
async def get_trades():
    return engine.trade_log


@router.get("/pnl/symbols")
async def get_symbol_pnl():
    """Per-symbol P&L aggregated from closed trades — daily and year-to-date."""
    from datetime import date as _date, datetime as _dt
    today = _date.today()
    year  = today.year
    out: Dict[str, Any] = {}
    for t in engine.trade_log:
        sym = t["symbol"]
        try:
            ts = _dt.fromisoformat(t["timestamp"]).date()
        except Exception:
            continue
        pl = t.get("pl", 0)
        if sym not in out:
            out[sym] = {"day": 0.0, "ytd": 0.0}
        if ts == today:
            out[sym]["day"] += pl
        if ts.year == year:
            out[sym]["ytd"] += pl
    return out


@router.get("/scan")
async def get_scan():
    return [
        {k: v for k, v in r.items() if k != "bars"}
        for r in engine.scan_results.values()
    ]


# ── Watchlist management ──────────────────────────────────────────────────────

@router.get("/watchlist")
async def get_watchlist():
    cfg = load()
    universe = cfg.get("scanner", {}).get("universe", [])
    sp_set   = set(SP500)
    nq_set   = set(NASDAQ100)
    dj_set   = set(DOW30)
    return {
        "universe": universe,
        "symbols": [
            {
                "symbol":  s,
                "markets": (
                    (["S&P 500"]   if s in sp_set else []) +
                    (["NASDAQ 100"] if s in nq_set else []) +
                    (["Dow 30"]    if s in dj_set else [])
                ),
            }
            for s in universe
        ],
    }


@router.post("/watchlist/{symbol}")
async def add_to_watchlist(symbol: str):
    sym = symbol.upper().strip()
    cfg = load()
    universe = cfg.setdefault("scanner", {}).setdefault("universe", [])
    if sym not in universe:
        universe.append(sym)
        save(cfg)
        await engine.reload()
    return {"ok": True, "universe": universe}


@router.delete("/watchlist/{symbol}")
async def remove_from_watchlist(symbol: str):
    sym = symbol.upper().strip()
    cfg = load()
    universe = cfg.get("scanner", {}).get("universe", [])
    if sym in universe:
        universe.remove(sym)
        save(cfg)
        await engine.reload()
    return {"ok": True, "universe": universe}


# ── Market universe endpoints ─────────────────────────────────────────────────

@router.get("/markets")
async def get_markets():
    return {
        "sp500":       SP500,
        "nasdaq100":   NASDAQ100,
        "dow30":       DOW30,
        "broad_etfs":  BROAD_ETFS,
        "sector_etfs": SECTOR_ETFS,
        "groups":      {k: {"label": v["label"], "color": v["color"], "count": len(v["symbols"])}
                        for k, v in GROUPS.items()},
    }


@router.post("/markets/add-all/{market}")
async def add_market_to_watchlist(market: str):
    mapping = {k: v["symbols"] for k, v in GROUPS.items()}
    symbols = mapping.get(market.lower())
    if not symbols:
        raise HTTPException(400, "Unknown market")
    cfg      = load()
    universe = cfg.setdefault("scanner", {}).setdefault("universe", [])
    added    = 0
    for s in symbols:
        if s not in universe:
            universe.append(s)
            added += 1
    save(cfg)
    await engine.reload()
    return {"ok": True, "added": added, "total": len(universe)}
