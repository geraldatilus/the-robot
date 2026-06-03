import React, { useState, useEffect } from "react";
import { Save, RotateCcw, FileCode, CheckCircle, AlertTriangle } from "lucide-react";
import jsYaml from "js-yaml";

const GUIDE = [
  { section: "STRATEGY", items: [
    ["ema_fast / ema_slow",   "EMA periods for trend filter (9 / 21)"],
    ["ema_buffer_pct",        "Min gap between EMAs — 0.001 = 0.1%"],
    ["min_relative_volume",   "Min vol vs average — 1.5 = 1.5×"],
    ["rsi_min / rsi_max",     "RSI entry window (50–70)"],
    ["atr_period",            "Candles to compute ATR (14)"],
    ["take_profit_atr_1/2/3", "Exit thirds at 1.5×, 3×, 5× ATR"],
    ["trailing_trigger_candles","Consecutive green bars to arm trailing"],
    ["timeframe",             "Bar size: 1Min / 5Min / 15Min / 1Hour"],
  ]},
  { section: "RISK", items: [
    ["max_position_pct",    "Max equity per trade — 0.15 = 15%"],
    ["risk_per_trade_pct",  "Risk per trade — 0.01 = 1%"],
    ["daily_loss_limit_pct","Kill-switch threshold — 0.03 = 3%"],
    ["max_open_positions",  "Max concurrent trades"],
  ]},
  { section: "SCANNER", items: [
    ["universe",   "Symbols to scan (list)"],
    ["min_price",  "Minimum stock price filter"],
    ["max_price",  "Maximum stock price filter"],
  ]},
];

export default function StrategyEditor() {
  const [yaml, setYaml]       = useState("");
  const [error, setError]     = useState(null);
  const [status, setStatus]   = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res  = await fetch("/api/config");
      const cfg  = await res.json();
      const safe = { ...cfg, alpaca: { ...cfg.alpaca, api_key: "***", secret_key: "***" } };
      setYaml(jsYaml.dump(safe, { lineWidth: 100, indent: 2 }));
    } catch {
      setStatus({ ok: false, msg: "Failed to load config" });
    }
  }

  function onChange(v) {
    setYaml(v);
    setError(null);
    try { jsYaml.load(v); }
    catch (e) { setError(e.message.slice(0, 80)); }
  }

  async function save() {
    if (error) return;
    try {
      const parsed  = jsYaml.load(yaml);
      const current = await (await fetch("/api/config")).json();
      if (parsed.alpaca?.api_key    === "***") parsed.alpaca.api_key    = current.alpaca?.api_key;
      if (parsed.alpaca?.secret_key === "***") parsed.alpaca.secret_key = current.alpaca?.secret_key;
      const res = await fetch("/api/config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      setStatus({ ok: res.ok, msg: res.ok ? "Saved & applied" : "Save failed" });
    } catch (e) {
      setStatus({ ok: false, msg: e.message });
    }
    setTimeout(() => setStatus(null), 3000);
  }

  return (
    <div className="flex flex-col h-full">
      {/* toolbar */}
      <div style={{ background: "#05070d", borderBottom: "1px solid #1a2740" }}
           className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileCode size={13} className="accent" />
          <span className="accent font-bold" style={{ letterSpacing: ".1em" }}>STRATEGY EDITOR</span>
          <span className="dim" style={{ fontSize: 11 }}>config.yaml</span>
        </div>
        <div className="flex items-center gap-3">
          {error  && <span className="bear flex items-center gap-1" style={{ fontSize: 11 }}><AlertTriangle size={11}/> {error}</span>}
          {status && <span className={`flex items-center gap-1 ${status.ok ? "bull" : "bear"}`} style={{ fontSize: 11 }}>
            {status.ok ? <CheckCircle size={11}/> : <AlertTriangle size={11}/>} {status.msg}
          </span>}
          <button className="btn btn-cyan" onClick={load}><RotateCcw size={11}/> RELOAD</button>
          <button className={`btn btn-green ${error ? "opacity-40" : ""}`} onClick={save} disabled={!!error}>
            <Save size={11}/> SAVE & APPLY
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* editor */}
        <textarea
          value={yaml}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          style={{
            flex: 1, background: "#07090f", color: "#c0d0e8",
            border: "none", borderRight: "1px solid #1a2740",
            fontFamily: "JetBrains Mono, monospace", fontSize: 12, lineHeight: 1.7,
            padding: 16, resize: "none", outline: "none",
          }}
        />

        {/* guide */}
        <div style={{ width: 280, background: "#05070d", overflowY: "auto", padding: 16 }}>
          <div className="accent font-bold" style={{ fontSize: 10, letterSpacing: ".12em", marginBottom: 16 }}>
            PARAMETER GUIDE
          </div>
          {GUIDE.map(({ section, items }) => (
            <div key={section} style={{ marginBottom: 18 }}>
              <div className="dim font-bold" style={{ fontSize: 9, letterSpacing: ".12em", marginBottom: 8 }}>
                {section}
              </div>
              {items.map(([key, desc]) => (
                <div key={key} style={{ marginBottom: 8 }}>
                  <div className="accent" style={{ fontSize: 11 }}>{key}</div>
                  <div className="dim" style={{ fontSize: 10, lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
