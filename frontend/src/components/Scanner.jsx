import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle, XCircle, ScanLine, Plus, X,
  TrendingUp, TrendingDown, ShoppingCart, Ban,
  ChevronDown as Caret, Layers, BarChart2, RefreshCw,
} from "lucide-react";
import useStore from "../store/useStore";
import toast from "react-hot-toast";

const TOAST = {
  style: { background:"#0c1120", color:"#c0d0e8", border:"1px solid #1a2740",
           fontFamily:"JetBrains Mono,monospace", fontSize:12 },
};
const f2 = (v) => v == null ? "—" : `$${Number(v).toFixed(2)}`;

// ─────────────────────────────────────────────────────────────────────────────
// Watchlist item (left panel)
// ─────────────────────────────────────────────────────────────────────────────
function PnlTag({ label, value }) {
  const hasVal = value != null && value !== 0;
  const pos    = hasVal && value >= 0;
  const color  = !hasVal ? "#3a4e6a" : pos ? "#00e676" : "#ff3355";
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                  padding:"1px 5px", borderRadius:2,
                  background: !hasVal ? "#1a274018" : pos ? "#00e67610" : "#ff335510",
                  border:`1px solid ${!hasVal ? "#1a274030" : pos ? "#00e67628" : "#ff335528"}` }}>
      <span style={{ fontSize:7, color:"#3a4e6a", letterSpacing:".06em" }}>{label}</span>
      <span style={{ fontSize:9, fontWeight:700, color }}>
        {!hasVal ? "—" : `${pos ? "+" : ""}$${Math.abs(value).toFixed(2)}`}
      </span>
    </div>
  );
}

function WatchlistItem({ sym, markets, scanResult, alpacaPos, pnl, isCurrent, onRemove }) {
  const passed   = scanResult?.status === "PASSED";
  const scanned  = !!scanResult;
  const scanning = isCurrent;

  return (
    <div style={{
      padding:"7px 10px 8px",
      borderBottom:"1px solid #1a274028",
      borderLeft:`2px solid ${scanning ? "#00c8f0" : passed ? "#00e676" : scanned ? "#ff335530" : "transparent"}`,
      background: scanning ? "#00c8f006" : passed ? "#00e67604" : "",
      transition:"border-color .3s, background .3s",
    }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:5, minWidth:0 }}>
          <div style={{
            width:7, height:7, borderRadius:"50%", flexShrink:0,
            background: scanning ? "#00c8f0" : passed ? "#00e676" : scanned ? "#ff3355" : "#1a2740",
            animation: scanning ? "pulse .8s infinite" : "none",
          }}/>
          <span className="ticker" style={{ fontSize:13 }}>{sym}</span>
          {scanning && <span style={{ fontSize:9, color:"#00c8f0", fontWeight:700 }} className="pulse">SCANNING</span>}
          {!scanning && scanned && (
            <span style={{
              padding:"1px 5px", borderRadius:2, fontSize:9, fontWeight:700,
              background: passed ? "#00e67615" : "#1a274030",
              color:      passed ? "#00e676"   : "#ff3355",
              border:    `1px solid ${passed ? "#00e67635" : "#ff335530"}`,
            }}>
              {passed ? "BUY" : "SKIP"}
            </span>
          )}
          {alpacaPos && <span className="badge badge-in" style={{ fontSize:8 }}>IN</span>}
        </div>
        <button onClick={() => onRemove(sym)}
                style={{ background:"none", border:"none", cursor:"pointer", color:"#1a2740", padding:2 }}
                onMouseEnter={e => e.currentTarget.style.color="#ff3355"}
                onMouseLeave={e => e.currentTarget.style.color="#1a2740"}>
          <X size={10}/>
        </button>
      </div>

      {/* DAY P&L + YEAR P&L always visible under the ticker */}
      <div style={{ display:"flex", gap:4, marginTop:5 }}>
        <PnlTag label="DAY P&L"  value={pnl?.day  ?? null}/>
        <PnlTag label="YEAR P&L" value={pnl?.ytd  ?? null}/>
        {alpacaPos && (
          <PnlTag label="OPEN P&L" value={alpacaPos.pl}/>
        )}
      </div>

      {/* gate chips */}
      {scanned && !scanning && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:2, marginTop:4 }}>
          {(scanResult.gates || []).map((g, i) => (
            <span key={i} title={g.detail} style={{
              padding:"1px 4px", borderRadius:2, fontSize:8,
              background: g.status === "PASS" ? "#00e67610" : "#ff335510",
              color:      g.status === "PASS" ? "#00e676"   : "#ff3355",
              border:    `1px solid ${g.status === "PASS" ? "#00e67628" : "#ff335528"}`,
            }}>
              {g.status === "PASS" ? "✓" : "✗"} {g.name.split(" ")[0]}
            </span>
          ))}
        </div>
      )}

      {/* BUY levels */}
      {passed && scanResult.entry_price && (
        <div style={{ display:"flex", gap:8, marginTop:4, fontSize:9 }}>
          <span>Entry <span className="accent font-bold">{f2(scanResult.entry_price)}</span></span>
          <span>Stop <span className="bear">{f2(scanResult.stop_price)}</span></span>
        </div>
      )}

      {/* position P&L */}
      {alpacaPos && (
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:4,
                      paddingTop:3, borderTop:"1px solid #1a274028", fontSize:9 }}>
          <span className="dim">{alpacaPos.qty} sh @ {f2(alpacaPos.entry_price)}</span>
          <span className={`font-bold ${alpacaPos.pl >= 0 ? "bull" : "bear"}`}>
            {alpacaPos.pl >= 0 ? "+" : ""}${Math.abs(alpacaPos.pl).toFixed(2)}
          </span>
        </div>
      )}

      {!scanned && !scanning && (
        <div className="dim" style={{ fontSize:9, marginTop:3 }}>Waiting…</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live scan feed card (center panel)
// ─────────────────────────────────────────────────────────────────────────────

function ScanCard({ result, isLatest, pnl, openPos }) {
  const passed = result.status === "PASSED";

  const pl = (v, label, alwaysShow = false) => {
    if (v == null && !alwaysShow) return null;
    const hasVal = v != null && v !== 0;
    const pos    = hasVal && v >= 0;
    const color  = !hasVal ? "#3a4e6a" : pos ? "#00e676" : "#ff3355";
    const bg     = !hasVal ? "#1a274018" : pos ? "#00e67612" : "#ff335512";
    const bdr    = !hasVal ? "#1a274040" : pos ? "#00e67630" : "#ff335530";
    return (
      <div style={{ display:"inline-flex", flexDirection:"column", alignItems:"center",
                    padding:"2px 8px", borderRadius:3, background:bg, border:`1px solid ${bdr}` }}>
        <span style={{ fontSize:8, color:"#3a4e6a", letterSpacing:".07em" }}>{label}</span>
        <span style={{ fontSize:11, fontWeight:700, color }}>
          {!hasVal ? "—" : `${pos ? "+" : ""}$${Math.abs(v).toFixed(2)}`}
        </span>
      </div>
    );
  };

  return (
    <div style={{
      background: isLatest ? (passed ? "#00e67608" : "#0c1120") : "#080d1860",
      border:`1px solid ${isLatest ? (passed ? "#00e67630" : "#1a2740") : "#1a274030"}`,
      borderRadius:4, padding:"12px 16px", marginBottom:8,
      transition:"all .3s",
    }}>
      {/* header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span className="ticker" style={{ fontSize:16 }}>{result.symbol}</span>

          {/* P&L — always visible right next to ticker */}
          {pl(pnl?.day ?? null, "DAY P&L",  true)}
          {pl(pnl?.ytd ?? null, "YEAR P&L", true)}

          {/* signal badge */}
          <span style={{
            display:"inline-flex", alignItems:"center", gap:4,
            padding:"3px 10px", borderRadius:3, fontSize:11, fontWeight:700,
            background: passed ? "#00e67618" : "#1a274040",
            color:      passed ? "#00e676"   : "#ff3355",
            border:    `1px solid ${passed ? "#00e67640" : "#ff335530"}`,
          }}>
            {passed ? <ShoppingCart size={11}/> : <Ban size={11}/>}
            {passed ? "BUY SIGNAL" : "NO TRADE"}
          </span>

          {/* open position — live unrealized P&L */}
          {openPos && pl(openPos.pl, "OPEN P&L")}

          {isLatest && (
            <span style={{ fontSize:9, color:"#00c8f0", fontWeight:700, letterSpacing:".08em" }}>
              ● LATEST
            </span>
          )}
        </div>
        <span className="dim" style={{ fontSize:10 }}>
          {result.timestamp ? new Date(result.timestamp).toLocaleTimeString() : ""}
        </span>
      </div>

      {/* gate results */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
        {(result.gates || []).map((g, i) => (
          <div key={i} style={{
            display:"inline-flex", alignItems:"center", gap:4,
            padding:"4px 10px", borderRadius:3, fontSize:10, fontWeight:600,
            background: g.status === "PASS" ? "#00e67612" : "#ff335512",
            color:      g.status === "PASS" ? "#00e676"   : "#ff3355",
            border:    `1px solid ${g.status === "PASS" ? "#00e67630" : "#ff335530"}`,
          }}>
            {g.status === "PASS"
              ? <CheckCircle size={10}/>
              : <XCircle    size={10}/>}
            <span>{g.name}</span>
            <span style={{ opacity:.6, fontSize:9 }}>— {g.detail}</span>
          </div>
        ))}
      </div>

      {/* reasoning */}
      <div style={{ fontSize:11, color: passed ? "#00e676b0" : "#3a4e6a", marginBottom: passed ? 10 : 0 }}>
        {result.reasoning}
      </div>

      {/* price levels on BUY */}
      {passed && result.entry_price && (
        <div style={{ display:"flex", gap:20, marginTop:8, paddingTop:8,
                      borderTop:"1px solid #1a274040", fontSize:11 }}>
          <Level label="ENTRY"    value={f2(result.entry_price)} color="#00c8f0"/>
          <Level label="STOP"     value={f2(result.stop_price)}  color="#ff3355"/>
          <Level label="TARGET 1" value={f2(result.target_1)}    color="#00e676"/>
          <Level label="TARGET 2" value={f2(result.target_2)}    color="#00e676"/>
          <Level label="TARGET 3" value={f2(result.target_3)}    color="#00e676"/>
          {result.qty && <Level label="SIZE" value={`${result.qty} sh`} color="#c0d0e8"/>}
        </div>
      )}
    </div>
  );
}

function Level({ label, value, color }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
      <span className="dim" style={{ fontSize:9, letterSpacing:".08em" }}>{label}</span>
      <span style={{ color, fontWeight:700, fontSize:13 }}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Scanner
// ─────────────────────────────────────────────────────────────────────────────
export default function Scanner() {
  const { scanResults, currentScan, state, dailyPnl, feedFilter } = useStore();

  const [watchlist,   setWatchlist]   = useState([]);
  const [marketData,  setMarketData]  = useState({});
  const [alpacaPos,   setAlpacaPos]   = useState([]);
  const [symPnl,      setSymPnl]      = useState({});
  const [addInput,    setAddInput]    = useState("");
  const [adding,      setAdding]      = useState(false);
  const [bulkOpen,    setBulkOpen]    = useState(false);
  const [bulkLoading, setBulkLoading] = useState(null);
  const addRef  = useRef(null);
  const bulkRef = useRef(null);
  const feedRef = useRef(null);

  useEffect(() => { loadWatchlist(); loadPositions(); loadSymPnl(); }, []);
  useEffect(() => { const t = setInterval(loadPositions, 8000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(loadSymPnl, 15000);   return () => clearInterval(t); }, []);

  // close bulk dropdown on outside click
  useEffect(() => {
    const h = (e) => { if (bulkRef.current && !bulkRef.current.contains(e.target)) setBulkOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // auto-scroll feed to top when new scan arrives
  const prevCount = useRef(0);
  useEffect(() => {
    if (scanResults.length > prevCount.current && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
    prevCount.current = scanResults.length;
  }, [scanResults.length]);

  async function loadWatchlist() {
    try {
      const [wl, mk] = await Promise.all([
        fetch("/api/watchlist").then(r => r.json()),
        fetch("/api/markets").then(r => r.json()),
      ]);
      setWatchlist(wl.symbols || []);
      setMarketData(mk);
    } catch {}
  }

  async function loadPositions() {
    try {
      const pos = await fetch("/api/positions").then(r => r.json());
      setAlpacaPos(Array.isArray(pos) ? pos : []);
    } catch {}
  }

  async function loadSymPnl() {
    try {
      const data = await fetch("/api/pnl/symbols").then(r => r.json());
      setSymPnl(data || {});
    } catch {}
  }

  async function addSymbol(sym) {
    const s = (sym || addInput).trim().toUpperCase();
    if (!s) return;
    setAdding(true);
    try {
      await fetch(`/api/watchlist/${s}`, { method:"POST" });
      setAddInput("");
      await loadWatchlist();
      toast.success(`${s} added to watchlist`, TOAST);
    } catch { toast.error("Failed to add", TOAST); }
    setAdding(false);
  }

  async function removeSymbol(sym) {
    try {
      await fetch(`/api/watchlist/${sym}`, { method:"DELETE" });
      await loadWatchlist();
      toast.success(`${sym} removed`, TOAST);
    } catch {}
  }

  async function addMarket(market) {
    setBulkLoading(market); setBulkOpen(false);
    try {
      const res = await fetch(`/api/markets/add-all/${market}`, { method:"POST" }).then(r => r.json());
      await loadWatchlist();
      const label = marketData.groups?.[market]?.label || market;
      toast.success(`Added ${res.added} symbols from ${label}`, TOAST);
    } catch { toast.error("Failed", TOAST); }
    setBulkLoading(null);
  }

  const universe     = watchlist.map(w => w.symbol);
  const scanBySymbol = Object.fromEntries(scanResults.map(r => [r.symbol, r]));
  const posBySymbol  = Object.fromEntries(alpacaPos.map(p => [p.symbol, p]));

  const passed = scanResults.filter(r => r.status === "PASSED").length;
  const failed = scanResults.filter(r => r.status === "FAILED").length;
  const totalPl = alpacaPos.reduce((s, p) => s + (p.pl || 0), 0);

  const heldSymbols = alpacaPos.map(p => p.symbol);

  // feed: most recent scans first, watchlist symbols only
  const feed = scanResults
    .filter(r => universe.includes(r.symbol))
    .filter(r => {
      if (feedFilter === "BUY")      return r.status === "PASSED";
      if (feedFilter === "SKIP")     return r.status === "FAILED";
      if (feedFilter === "HOLDINGS") return heldSymbols.includes(r.symbol);
      return true;
    })
    .slice(0, 40);

  const latestSym = feed[0]?.symbol;

  const BULK_OPTIONS = [
    { id:"sp500",       label:"S&P 500",      count:71, color:"#00c8f0", desc:"Large-cap US stocks"    },
    { id:"nasdaq100",   label:"NASDAQ 100",   count:60, color:"#00e676", desc:"Tech-heavy growth"      },
    { id:"dow30",       label:"Dow Jones 30", count:30, color:"#ffd600", desc:"Blue-chip industrials"  },
    { id:"broad_etfs",  label:"Broad ETFs",   count:39, color:"#c084fc", desc:"Index & leveraged ETFs" },
    { id:"sector_etfs", label:"Sector ETFs",  count:30, color:"#f97316", desc:"XLF, XLE, SMH, SOXX…"  },
  ];

  return (
    <div style={{ display:"flex", height:"100%" }}>

      {/* ══ LEFT PANEL — WATCHLIST ═══════════════════════════════════════════ */}
      <div style={{ width:250, background:"#05070d", borderRight:"1px solid #1a2740",
                    display:"flex", flexDirection:"column", flexShrink:0 }}>

        {/* live scan ticker */}
        <div style={{
          padding:"7px 10px", borderBottom:"1px solid #1a2740", flexShrink:0,
          background: state === "RUNNING" ? "#00c8f006" : "#07090f",
          display:"flex", alignItems:"center", justifyContent:"space-between", minHeight:34,
        }}>
          {state === "RUNNING" && currentScan ? (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:"#00c8f0",
                              animation:"pulse .8s infinite", flexShrink:0 }}/>
                <span style={{ fontSize:10, color:"#3a4e6a" }}>Scanning</span>
                <span className="accent font-bold" style={{ fontSize:11 }}>{currentScan}</span>
              </div>
              <div style={{ display:"flex", gap:8, fontSize:9 }}>
                <span className="bull">{passed}<span className="dim"> BUY</span></span>
                <span className="bear">{failed}<span className="dim"> SKIP</span></span>
              </div>
            </>
          ) : (
            <span style={{ fontSize:10, color:"#1a2740" }}>
              {state === "RUNNING" ? "Connecting…" : "Engine stopped"}
            </span>
          )}
        </div>

        {/* add single ticker */}
        <div style={{ padding:"8px 10px", borderBottom:"1px solid #1a2740", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:7 }}>
            <span className="accent font-bold" style={{ fontSize:10, letterSpacing:".1em" }}>WATCHLIST</span>
            <span className="dim" style={{ fontSize:9 }}>{universe.length} symbols</span>
          </div>
          <div style={{ display:"flex", gap:5, marginBottom:7 }}>
            <input ref={addRef} className="inp" value={addInput}
                   onChange={e => setAddInput(e.target.value.toUpperCase())}
                   onKeyDown={e => e.key === "Enter" && addSymbol()}
                   placeholder="Add ticker…"
                   style={{ fontSize:11, padding:"5px 8px" }}/>
            <button onClick={() => addSymbol()} disabled={adding}
                    className="btn btn-cyan" style={{ padding:"5px 9px", flexShrink:0 }}>
              <Plus size={12}/>
            </button>
          </div>

          {/* bulk-add dropdown */}
          <div ref={bulkRef} style={{ position:"relative" }}>
            <button onClick={() => setBulkOpen(o => !o)} className="btn btn-cyan"
                    style={{ width:"100%", justifyContent:"space-between", padding:"5px 10px", fontSize:11 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <Layers size={11}/>
                {bulkLoading
                  ? `Adding ${marketData.groups?.[bulkLoading]?.label || bulkLoading}…`
                  : "Bulk Add Index / ETF"}
              </div>
              <Caret size={11} style={{ transform: bulkOpen ? "rotate(180deg)" : "none", transition:".15s" }}/>
            </button>

            {bulkOpen && (
              <div style={{
                position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:100,
                background:"#0c1120", border:"1px solid #1a2740", borderRadius:4,
                boxShadow:"0 10px 30px #00000090",
              }}>
                {BULK_OPTIONS.map(g => (
                  <button key={g.id} onClick={() => addMarket(g.id)}
                          style={{ display:"block", width:"100%", textAlign:"left",
                                   padding:"9px 12px", background:"none", border:"none",
                                   borderBottom:"1px solid #1a274040", cursor:"pointer" }}
                          onMouseEnter={e => e.currentTarget.style.background="#1a274030"}
                          onMouseLeave={e => e.currentTarget.style.background="none"}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:g.color }}/>
                        <span style={{ color:"#c0d0e8", fontSize:12, fontFamily:"inherit", fontWeight:600 }}>{g.label}</span>
                      </div>
                      <span style={{ color:"#3a4e6a", fontSize:10 }}>{g.count} symbols</span>
                    </div>
                    <div style={{ color:"#3a4e6a", fontSize:10, marginTop:2, paddingLeft:15 }}>{g.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* positions summary */}
        {alpacaPos.length > 0 && (
          <div style={{ padding:"7px 10px", borderBottom:"1px solid #1a2740",
                        background:"#080d1870", flexShrink:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <span className="dim" style={{ fontSize:9, letterSpacing:".1em" }}>
                <BarChart2 size={9} style={{ display:"inline", marginRight:4 }}/>POSITIONS
              </span>
              <span className={`font-bold ${totalPl >= 0 ? "bull" : "bear"}`} style={{ fontSize:10 }}>
                {totalPl >= 0 ? "+" : ""}${Math.abs(totalPl).toFixed(2)}
              </span>
            </div>
            {alpacaPos.map(p => (
              <div key={p.symbol} style={{ display:"flex", justifyContent:"space-between",
                                           fontSize:10, marginBottom:2 }}>
                <span><span className="ticker" style={{ fontSize:11 }}>{p.symbol}</span>
                  <span className="dim" style={{ marginLeft:5 }}>{p.qty} sh</span></span>
                <span className={`font-bold ${p.pl >= 0 ? "bull" : "bear"}`}>
                  {p.pl >= 0 ? "+" : ""}${Math.abs(p.pl).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* watchlist symbols */}
        <div style={{ flex:1, overflowY:"auto" }}>
          {universe.length === 0 && (
            <div className="dim" style={{ padding:16, fontSize:11, textAlign:"center", lineHeight:1.7 }}>
              Add tickers above to start monitoring
            </div>
          )}
          {watchlist.map(w => (
            <WatchlistItem
              key={w.symbol}
              sym={w.symbol}
              markets={w.markets}
              scanResult={scanBySymbol[w.symbol]}
              alpacaPos={posBySymbol[w.symbol]}
              pnl={symPnl[w.symbol] || null}
              isCurrent={currentScan === w.symbol}
              onRemove={removeSymbol}
            />
          ))}
        </div>
      </div>

      {/* ══ CENTER PANEL — LIVE SCAN FEED ════════════════════════════════════ */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>

        {/* feed header */}
        <div style={{ background:"#05070d", borderBottom:"1px solid #1a2740",
                      padding:"8px 16px", display:"flex", alignItems:"center",
                      justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <ScanLine size={13} className="accent"/>
            <span className="accent font-bold" style={{ letterSpacing:".1em" }}>LIVE SCAN FEED</span>

            {state === "RUNNING" && currentScan && (
              <div style={{ display:"flex", alignItems:"center", gap:6,
                            padding:"3px 10px", borderRadius:3,
                            background:"#00c8f010", border:"1px solid #00c8f030" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#00c8f0",
                              animation:"pulse .8s infinite" }}/>
                <span style={{ fontSize:11, color:"#00c8f0", fontWeight:600 }}>
                  NOW SCANNING: {currentScan}
                </span>
              </div>
            )}

            {state !== "RUNNING" && (
              <span style={{ fontSize:11, color:"#1a2740" }}>Start engine to begin scanning</span>
            )}
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span className="bull" style={{ fontSize:11 }}>{passed} <span className="dim">BUY</span></span>
            <span className="bear" style={{ fontSize:11 }}>{failed} <span className="dim">SKIP</span></span>
          </div>
        </div>

        {/* currently scanning active card */}
        {state === "RUNNING" && currentScan && !scanBySymbol[currentScan] && (
          <div style={{ margin:"12px 16px 0", background:"#0c1120",
                        border:"1px solid #00c8f030", borderRadius:4, padding:"16px 20px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <div style={{ width:9, height:9, borderRadius:"50%", background:"#00c8f0",
                            animation:"pulse .7s infinite" }}/>
              <span className="ticker" style={{ fontSize:18 }}>{currentScan}</span>
              <span style={{ fontSize:11, color:"#00c8f0", fontWeight:600, letterSpacing:".1em" }}>
                EVALUATING GATES…
              </span>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              {["Price > VWAP","EMA Cross","RSI","Relative Volume"].map((g, i) => (
                <div key={i} style={{
                  padding:"4px 10px", borderRadius:3, fontSize:10,
                  background:"#1a274030", color:"#3a4e6a",
                  border:"1px solid #1a274060",
                  animation:`pulse ${1 + i * 0.2}s infinite`,
                }}>
                  {g}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* scan result feed */}
        <div ref={feedRef} style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>
          {feed.length === 0 && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                          justifyContent:"center", height:"60%", gap:12 }}>
              <ScanLine size={40} style={{ color:"#1a2740" }}/>
              <span style={{ color:"#1a2740", fontSize:13 }}>
                {feedFilter === "HOLDINGS" && heldSymbols.length === 0
                  ? "No open positions on Alpaca"
                  : feedFilter === "HOLDINGS"
                  ? `Waiting for scan results on: ${heldSymbols.join(", ")}`
                  : state === "RUNNING"
                  ? "Scanning in progress — results will appear here"
                  : "Start the engine to begin scanning your watchlist"}
              </span>
            </div>
          )}
          {feed.map((r, i) => (
            <ScanCard key={`${r.symbol}-${r.timestamp}`} result={r} isLatest={i === 0}
                      pnl={symPnl[r.symbol] || null}
                      openPos={posBySymbol[r.symbol] || null}/>
          ))}
        </div>

        {/* footer */}
        <div style={{ background:"#05070d", borderTop:"1px solid #1a2740",
                      padding:"6px 16px", display:"flex", alignItems:"center",
                      justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", gap:20 }}>
            <Kv label="DAY P&L"  value={`${dailyPnl >= 0 ? "+" : ""}$${Math.abs(dailyPnl).toFixed(2)}`}
                cls={dailyPnl >= 0 ? "bull" : "bear"}/>
            <Kv label="WATCHING" value={universe.length}/>
            <Kv label="SCANNED"  value={scanResults.length}/>
            <Kv label="BUY SIGNALS" value={passed} cls="bull"/>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kv({ label, value, cls="" }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <span className="dim" style={{ fontSize:10 }}>{label}</span>
      <span className={`font-bold ${cls}`} style={{ fontSize:12 }}>{value}</span>
    </div>
  );
}
