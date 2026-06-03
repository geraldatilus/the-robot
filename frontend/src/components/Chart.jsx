import React, { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode, LineStyle } from "lightweight-charts";
import { RefreshCw, TrendingUp } from "lucide-react";

const CHART_OPTS = {
  layout:     { background: { color: "#0c1120" }, textColor: "#3a4e6a" },
  grid:       { vertLines: { color: "#1a274030" }, horzLines: { color: "#1a274030" } },
  crosshair:  { mode: CrosshairMode.Normal,
                vertLine: { color: "#00c8f040" }, horzLine: { color: "#00c8f040" } },
  rightPriceScale: { borderColor: "#1a2740", scaleMargins: { top: 0.08, bottom: 0.22 } },
  timeScale:  { borderColor: "#1a2740", timeVisible: true, secondsVisible: false },
};

export default function Chart({ symbol, position }) {
  const ref       = useRef(null);
  const chart     = useRef(null);
  const candles   = useRef(null);
  const volume    = useRef(null);
  const lines     = useRef({});
  const [tf, setTf]         = useState("1Min");
  const [loading, setLoad]  = useState(false);

  /* init chart */
  useEffect(() => {
    if (!ref.current) return;
    const c = createChart(ref.current, {
      ...CHART_OPTS,
      width:  ref.current.clientWidth,
      height: ref.current.clientHeight,
    });
    chart.current   = c;
    candles.current = c.addCandlestickSeries({
      upColor: "#00e676", downColor: "#ff3355",
      borderUpColor: "#00e676", borderDownColor: "#ff3355",
      wickUpColor: "#00e67670", wickDownColor: "#ff335570",
    });
    volume.current = c.addHistogramSeries({
      priceFormat: { type: "volume" }, priceScaleId: "vol",
    });
    c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const ro = new ResizeObserver(() => {
      if (ref.current) c.applyOptions({ width: ref.current.clientWidth, height: ref.current.clientHeight });
    });
    ro.observe(ref.current);
    return () => { c.remove(); ro.disconnect(); };
  }, []);

  /* load bars when symbol / tf changes */
  useEffect(() => { if (symbol) load(); }, [symbol, tf]);

  /* draw position lines */
  useEffect(() => {
    if (!candles.current) return;
    Object.values(lines.current).forEach((l) => { try { candles.current.removePriceLine(l); } catch {} });
    lines.current = {};
    if (!position) return;

    const add = (price, color, title, style = LineStyle.Solid, width = 2) => {
      if (!price) return;
      lines.current[title] = candles.current.createPriceLine({ price, color, lineWidth: width, lineStyle: style, axisLabelVisible: true, title });
    };

    add(position.entry_price, "#00c8f0",  "▶ ENTRY");
    add(position.stop_price,  "#ff3355",  position.trail_active ? "⬆ TRAIL" : "✕ STOP", LineStyle.Dashed);
    if (!position.t1_done) add(position.target_1, "#00e676", "T1 +1.5×", LineStyle.Dashed, 1);
    if (!position.t2_done) add(position.target_2, "#00e676", "T2 +3×",   LineStyle.Dashed, 1);
    add(position.target_3, "#00e676", "T3 +5×", LineStyle.Dashed, 1);
  }, [position]);

  async function load() {
    if (!symbol) return;
    setLoad(true);
    try {
      const res  = await fetch(`/api/charts/${symbol}?timeframe=${tf}&limit=200`);
      const json = await res.json();
      const bars = json.bars || [];
      if (candles.current && bars.length) {
        candles.current.setData(bars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close })));
        volume.current.setData(bars.map((b) => ({ time: b.time, value: b.volume, color: b.close >= b.open ? "#00e67620" : "#ff335520" })));
        chart.current.timeScale().fitContent();
      }
    } catch {}
    setLoad(false);
  }

  if (!symbol) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 dim">
        <TrendingUp size={36} style={{ opacity: .2 }} />
        <span style={{ fontSize: 12 }}>No open position to chart</span>
        <span style={{ fontSize: 10 }}>Enter a trade to see a live chart here</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* chart header */}
      <div style={{ background: "#05070d", borderBottom: "1px solid #1a2740" }}
           className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="ticker" style={{ fontSize: 14 }}>{symbol}</span>
          {position && (
            <>
              <span className="dim">Entry</span>
              <span className="accent font-bold">${Number(position.entry_price).toFixed(2)}</span>
              <span className={position.pl >= 0 ? "bull font-bold" : "bear font-bold"}>
                {position.pl >= 0 ? "+" : ""}${Number(position.pl).toFixed(2)}
                &nbsp;({position.pl_pct >= 0 ? "+" : ""}{Number(position.pl_pct).toFixed(2)}%)
              </span>
              {position.trail_active && <span className="badge badge-pass">⬆ TRAILING</span>}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {["1Min","5Min","15Min","1Hour"].map((t) => (
            <button key={t} onClick={() => setTf(t)}
                    className="btn" style={{ padding: "2px 8px", fontSize: 10,
                      borderColor: tf === t ? "#00c8f0" : "#1a2740",
                      color:       tf === t ? "#00c8f0" : "#3a4e6a" }}>
              {t}
            </button>
          ))}
          <button onClick={load} className="btn" style={{ padding: "2px 6px", borderColor: "#1a2740", color: "#3a4e6a" }}>
            <RefreshCw size={11} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>
      <div ref={ref} className="flex-1" />
    </div>
  );
}
