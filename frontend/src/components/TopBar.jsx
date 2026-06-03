import React from "react";
import { Zap, ZapOff, Wifi, WifiOff, AlertTriangle, Radio, RefreshCw } from "lucide-react";
import useStore from "../store/useStore";

const f2 = (v) => v == null ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATE = {
  RUNNING:     { label: "LIVE",        dot: "#00e676", cls: "bull" },
  STOPPED:     { label: "STOPPED",     dot: "#3a4e6a", cls: "dim"  },
  ERROR:       { label: "ERROR",       dot: "#ff3355", cls: "bear" },
  KILL_SWITCH: { label: "KILL SWITCH", dot: "#ffd600", cls: "warn" },
};

const MODE_CFG = {
  STREAMING: { label: "IEX STREAM",  color: "#00e676", Icon: Radio,       tip: "Live bars via wss://stream.data.alpaca.markets/v2/iex" },
  POLLING:   { label: "IEX POLLING", color: "#ffd600", Icon: RefreshCw,   tip: "Polling REST v2/iex — market closed or stream reconnecting" },
  IDLE:      { label: "IDLE",        color: "#3a4e6a", Icon: Radio,       tip: "Engine stopped" },
};

export default function TopBar({ onStart, onStop }) {
  const { state, scanMode, account, dailyPnl, connected, positions, lastError } = useStore();
  const sc   = STATE[state] || STATE.STOPPED;
  const mode = MODE_CFG[scanMode] || MODE_CFG.IDLE;
  const ModeIcon = mode.Icon;

  return (
    <div style={{ background:"#05070d", borderBottom:"1px solid #1a2740", height:50 }}
         className="flex items-center justify-between px-4 flex-shrink-0">

      {/* ── left: logo + status ── */}
      <div className="flex items-center gap-3">
        <div style={{ background:"linear-gradient(135deg,#00c8f0,#0060c0)", borderRadius:4, width:28, height:28 }}
             className="flex items-center justify-center">
          <Zap size={15} color="#fff"/>
        </div>
        <span style={{ color:"#00c8f0", fontSize:13, fontWeight:700, letterSpacing:".15em" }}>
          THE ROBOT
        </span>

        <div style={{ width:1, height:22, background:"#1a2740", margin:"0 4px" }}/>

        {/* engine state dot */}
        <div className="flex items-center gap-2">
          <div style={{ width:7, height:7, borderRadius:"50%", background:sc.dot }}
               className={state === "RUNNING" ? "pulse" : ""}/>
          <span className={`${sc.cls} font-bold`} style={{ fontSize:11, letterSpacing:".1em" }}>
            {sc.label}
          </span>
        </div>

        {/* data feed mode badge */}
        {state === "RUNNING" && (
          <div title={mode.tip}
               style={{
                 display:"inline-flex", alignItems:"center", gap:5,
                 padding:"2px 8px", borderRadius:3, cursor:"default",
                 background: `${mode.color}12`,
                 border:     `1px solid ${mode.color}35`,
                 color:       mode.color,
                 fontSize:10, fontWeight:700, letterSpacing:".06em",
               }}>
            <ModeIcon size={10} className={scanMode === "POLLING" ? "spin" : ""}/>
            {mode.label}
          </div>
        )}

        {/* WS connection */}
        <div className="flex items-center gap-1 dim">
          {connected
            ? <Wifi size={11} className="bull"/>
            : <WifiOff size={11} className="bear pulse"/>}
          <span style={{ fontSize:10 }}>{connected ? "UI CONNECTED" : "RECONNECTING"}</span>
        </div>

        {/* kill switch warning */}
        {state === "KILL_SWITCH" && (
          <div className="flex items-center gap-1 warn badge badge-warn">
            <AlertTriangle size={10}/> DAILY LOSS LIMIT HIT
          </div>
        )}

        {/* inline error */}
        {lastError && state !== "STOPPED" && (
          <div className="flex items-center gap-1 bear" title={lastError}
               style={{ fontSize:10, maxWidth:300, overflow:"hidden",
                        textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            <AlertTriangle size={10}/> {lastError}
          </div>
        )}
      </div>

      {/* ── center: account stats ── */}
      <div className="flex items-center gap-6">
        <Stat label="EQUITY"    value={`$${f2(account?.equity)}`}/>
        <Stat label="CASH"      value={`$${f2(account?.cash)}`}/>
        <Stat label="BUY PWR"   value={`$${f2(account?.buying_power)}`}/>
        <Stat label="DAY P&L"
              value={`${dailyPnl >= 0 ? "+" : ""}$${f2(dailyPnl)}`}
              color={dailyPnl > 0 ? "bull" : dailyPnl < 0 ? "bear" : ""}/>
        <Stat label="POSITIONS" value={positions.length}/>
      </div>

      {/* ── right: engine toggle ── */}
      <div className="flex gap-2">
        {state === "RUNNING"
          ? <button className="btn btn-red"   onClick={onStop}><ZapOff size={12}/> STOP</button>
          : <button className="btn btn-green" onClick={onStart}><Zap size={12}/> START ENGINE</button>
        }
      </div>
    </div>
  );
}

function Stat({ label, value, color = "" }) {
  return (
    <div className="flex flex-col items-end">
      <span className="dim" style={{ fontSize:9, letterSpacing:".1em" }}>{label}</span>
      <span className={`font-semibold ${color}`} style={{ fontSize:12 }}>{value}</span>
    </div>
  );
}
