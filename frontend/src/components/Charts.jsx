import React, { useState, useEffect, useRef, useCallback } from "react";
import { createChart, CrosshairMode, LineStyle } from "lightweight-charts";
import { Maximize2, Minimize2, RefreshCw, TrendingUp, TrendingDown, X } from "lucide-react";
import useStore from "../store/useStore";

const CHART_THEME = {
  layout:    { background: { color: "#0c1120" }, textColor: "#3a4e6a" },
  grid:      { vertLines: { color: "#1a274025" }, horzLines: { color: "#1a274025" } },
  crosshair: { mode: CrosshairMode.Normal,
               vertLine: { color: "#00c8f050" }, horzLine: { color: "#00c8f050" } },
  rightPriceScale: { borderColor: "#1a2740", scaleMargins: { top: 0.08, bottom: 0.2 } },
  timeScale: { borderColor: "#1a2740", timeVisible: true, secondsVisible: false },
};

const f2  = (v) => v == null ? "—" : `$${Number(v).toFixed(2)}`;
const fpl = (v, pct) => {
  if (v == null) return "—";
  const s = v >= 0 ? "+" : "";
  return `${s}$${Math.abs(v).toFixed(2)} (${s}${((pct||0)*100).toFixed(2)}%)`;
};

// ── Single chart pane ─────────────────────────────────────────────────────────
function PositionChart({ position, enginePos, expanded, onExpand, onClose }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const candleRef    = useRef(null);
  const volumeRef    = useRef(null);
  const linesRef     = useRef({});
  const [tf, setTf]              = useState("1Min");
  const [loading, setLoading]   = useState(false);
  const [ohlc, setOhlc]         = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const currentLineRef = useRef(null);

  // init chart
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });
    chartRef.current   = chart;
    candleRef.current  = chart.addCandlestickSeries({
      upColor:        "#00e676", downColor:       "#ff3355",
      borderUpColor:  "#00e676", borderDownColor: "#ff3355",
      wickUpColor:    "#00e67660", wickDownColor: "#ff335560",
    });
    volumeRef.current = chart.addHistogramSeries({
      priceFormat: { type: "volume" }, priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    // subscribe to crosshair for OHLC display
    chart.subscribeCrosshairMove((param) => {
      if (param.seriesData && candleRef.current) {
        const bar = param.seriesData.get(candleRef.current);
        if (bar) setOhlc(bar);
      }
    });

    return () => { chart.remove(); ro.disconnect(); };
  }, []);

  // draw price lines when position or enginePos changes
  useEffect(() => {
    if (!candleRef.current) return;
    Object.values(linesRef.current).forEach(l => { try { candleRef.current.removePriceLine(l); } catch {} });
    linesRef.current = {};

    const entry = position.entry_price;
    if (entry) {
      linesRef.current.entry = candleRef.current.createPriceLine({
        price: entry, color: "#00c8f0", lineWidth: 2,
        lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "▶ ENTRY",
      });
    }

    if (enginePos) {
      if (enginePos.stop_price) {
        linesRef.current.stop = candleRef.current.createPriceLine({
          price: enginePos.stop_price, color: "#ff3355", lineWidth: 2,
          lineStyle: LineStyle.Dashed, axisLabelVisible: true,
          title: enginePos.trail_active ? "⬆ TRAIL STOP" : "✕ STOP",
        });
      }
      if (enginePos.target_1 && !enginePos.t1_done) {
        linesRef.current.t1 = candleRef.current.createPriceLine({
          price: enginePos.target_1, color: "#00e67680", lineWidth: 1,
          lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "T1 +1.5×ATR",
        });
      }
      if (enginePos.target_2 && !enginePos.t2_done) {
        linesRef.current.t2 = candleRef.current.createPriceLine({
          price: enginePos.target_2, color: "#00e676a0", lineWidth: 1,
          lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "T2 +3×ATR",
        });
      }
      if (enginePos.target_3) {
        linesRef.current.t3 = candleRef.current.createPriceLine({
          price: enginePos.target_3, color: "#00e676", lineWidth: 1,
          lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "T3 +5×ATR",
        });
      }
    }
  }, [position, enginePos]);

  // reload when symbol or tf changes, or when expanded changes (resize)
  useEffect(() => { loadBars(); }, [position.symbol, tf]);
  useEffect(() => {
    if (chartRef.current && containerRef.current) {
      setTimeout(() => {
        chartRef.current?.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
        chartRef.current?.timeScale().fitContent();
      }, 80);
    }
  }, [expanded]);

  async function loadBars() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/charts/${position.symbol}?timeframe=${tf}&limit=200`);
      const json = await res.json();
      const bars = json.bars || [];
      if (candleRef.current && bars.length) {
        candleRef.current.setData(bars.map(b => ({
          time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
        })));
        volumeRef.current.setData(bars.map(b => ({
          time: b.time, value: b.volume,
          color: b.close >= b.open ? "#00e67622" : "#ff335522",
        })));
        chartRef.current.timeScale().fitContent();

        // draw / update current price line (blue)
        const latest = bars[bars.length - 1].close;
        setCurrentPrice(latest);
        try { if (currentLineRef.current) candleRef.current.removePriceLine(currentLineRef.current); } catch {}
        currentLineRef.current = candleRef.current.createPriceLine({
          price:            latest,
          color:            "#4499ff",
          lineWidth:        2,
          lineStyle:        0,   // solid
          axisLabelVisible: true,
          title:            `● ${latest.toFixed(2)}`,
        });
      }
    } catch {}
    setLoading(false);
  }

  const pl    = position.pl    ?? 0;
  const plPct = position.pl_pct ?? 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", background:"#0c1120",
                  border:"1px solid #1a2740", borderRadius:4, overflow:"hidden", height:"100%" }}>

      {/* header */}
      <div style={{ background:"#080d18", borderBottom:"1px solid #1a2740",
                    padding:"6px 10px", display:"flex", alignItems:"center",
                    justifyContent:"space-between", flexShrink:0 }}>
        <div className="flex items-center gap-3">
          <span className="ticker" style={{ fontSize:14 }}>{position.symbol}</span>

          {/* P&L */}
          <span className={`font-bold ${pl >= 0 ? "bull" : "bear"}`} style={{ fontSize:12 }}>
            {pl >= 0 ? <TrendingUp size={11} style={{ display:"inline", marginRight:3 }}/>
                     : <TrendingDown size={11} style={{ display:"inline", marginRight:3 }}/>}
            {fpl(pl, plPct)}
          </span>

          {/* position details */}
          {/* current price — blue */}
          {currentPrice && (
            <span style={{
              fontSize:13, fontWeight:700, color:"#4499ff",
              padding:"1px 8px", borderRadius:3,
              background:"#4499ff15", border:"1px solid #4499ff40",
            }}>
              ${currentPrice.toFixed(2)}
            </span>
          )}

          <span className="dim" style={{ fontSize:10 }}>
            {position.qty} sh @ {f2(position.entry_price)}
          </span>

          {/* engine badges */}
          {enginePos?.trail_active && (
            <span className="badge badge-pass" style={{ fontSize:9 }}>⬆ TRAILING</span>
          )}

          {/* OHLC overlay */}
          {ohlc && (
            <span className="dim" style={{ fontSize:10 }}>
              O:{ohlc.open?.toFixed(2)} H:{ohlc.high?.toFixed(2)} L:{ohlc.low?.toFixed(2)} C:{ohlc.close?.toFixed(2)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* legend */}
          <div className="flex items-center gap-3" style={{ marginRight:8 }}>
            {currentPrice          && <LegendDot color="#4499ff" label="Now" />}
            <LegendDot color="#00c8f0" label="Entry" />
            {enginePos?.stop_price  && <LegendDot color="#ff3355" label={enginePos.trail_active ? "Trail Stop" : "Stop"} dashed />}
            {enginePos?.target_1    && <LegendDot color="#00e676" label="T1/T2/T3" dashed />}
          </div>

          {/* timeframe */}
          {["1Min","5Min","15Min","1Hour"].map(t => (
            <button key={t} onClick={() => setTf(t)} className="btn"
                    style={{ padding:"2px 6px", fontSize:9,
                             borderColor: tf === t ? "#00c8f0" : "#1a2740",
                             color:       tf === t ? "#00c8f0" : "#3a4e6a" }}>
              {t}
            </button>
          ))}

          <button onClick={loadBars} className="btn"
                  style={{ padding:"2px 5px", borderColor:"#1a2740", color:"#3a4e6a" }}>
            <RefreshCw size={10} className={loading ? "spin" : ""} />
          </button>

          <button onClick={onExpand} className="btn"
                  style={{ padding:"2px 5px", borderColor:"#1a2740", color:"#3a4e6a" }}
                  title={expanded ? "Minimize" : "Fullscreen"}>
            {expanded ? <Minimize2 size={11}/> : <Maximize2 size={11}/>}
          </button>
        </div>
      </div>

      {/* chart canvas */}
      <div ref={containerRef} style={{ flex:1, minHeight:0 }} />
    </div>
  );
}

function LegendDot({ color, label, dashed }) {
  return (
    <div className="flex items-center gap-1 dim" style={{ fontSize:9 }}>
      <div style={{ width:16, height:2, background: dashed ? "transparent" : color,
                    borderTop: dashed ? `2px dashed ${color}` : "none" }} />
      {label}
    </div>
  );
}

// ── Charts tab ────────────────────────────────────────────────────────────────
export default function Charts() {
  const { positions: enginePositions } = useStore();
  const [alpacaPos,  setAlpacaPos]   = useState([]);
  const [fullscreen, setFullscreen]  = useState(null);   // symbol or null
  const [loading,    setLoading]     = useState(true);

  useEffect(() => { loadPositions(); }, []);
  useEffect(() => {
    const t = setInterval(loadPositions, 10000);
    return () => clearInterval(t);
  }, []);

  async function loadPositions() {
    try {
      const pos = await fetch("/api/positions").then(r => r.json());
      setAlpacaPos(Array.isArray(pos) ? pos : []);
    } catch {}
    setLoading(false);
  }

  // combine Alpaca real positions with engine-managed data
  const allPositions = alpacaPos.map(ap => ({
    ...ap,
    enginePos: enginePositions.find(ep => ep.symbol === ap.symbol) || null,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full dim" style={{ fontSize:12 }}>
        Loading positions…
      </div>
    );
  }

  if (allPositions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 dim">
        <TrendingUp size={40} style={{ opacity:.15 }} />
        <span style={{ fontSize:13 }}>No open positions</span>
        <span style={{ fontSize:11 }}>Positions opened on Alpaca will appear here with live charts</span>
        <button onClick={loadPositions} className="btn btn-cyan" style={{ marginTop:8 }}>
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
    );
  }

  // fullscreen overlay
  if (fullscreen) {
    const pos = allPositions.find(p => p.symbol === fullscreen);
    if (pos) return (
      <div style={{ position:"fixed", inset:0, zIndex:100, background:"#07090f",
                    display:"flex", flexDirection:"column" }}>
        <PositionChart
          position={pos}
          enginePos={pos.enginePos}
          expanded={true}
          onExpand={() => setFullscreen(null)}
          onClose={() => setFullscreen(null)}
        />
      </div>
    );
  }

  // grid layout
  const count = allPositions.length;
  const cols  = count === 1 ? 1 : count <= 4 ? 2 : 3;
  const rows  = Math.ceil(count / cols);

  return (
    <div style={{ height:"100%", overflow:"hidden", padding:8, background:"#07090f" }}>
      {/* position count bar */}
      <div style={{ marginBottom:6, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div className="flex items-center gap-4">
          <span className="dim font-bold" style={{ fontSize:10, letterSpacing:".1em" }}>
            {count} OPEN POSITION{count !== 1 ? "S" : ""}
          </span>
          {alpacaPos.map(p => (
            <span key={p.symbol} className="flex items-center gap-1" style={{ fontSize:11 }}>
              <span className="ticker">{p.symbol}</span>
              <span className={p.pl >= 0 ? "bull" : "bear"} style={{ fontWeight:700 }}>
                {p.pl >= 0 ? "+" : ""}${Math.abs(p.pl).toFixed(2)}
              </span>
            </span>
          ))}
        </div>
        <button onClick={loadPositions} className="btn btn-cyan" style={{ padding:"3px 10px", fontSize:10 }}>
          <RefreshCw size={10} /> Refresh
        </button>
      </div>

      {/* chart grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows:    `repeat(${rows}, 1fr)`,
        gap: 8,
        height: "calc(100% - 34px)",
      }}>
        {allPositions.map(pos => (
          <PositionChart
            key={pos.symbol}
            position={pos}
            enginePos={pos.enginePos}
            expanded={false}
            onExpand={() => setFullscreen(pos.symbol)}
            onClose={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
