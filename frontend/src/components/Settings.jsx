import React, { useState, useEffect } from "react";
import { Key, RefreshCw, Trash2, CheckCircle, AlertTriangle, Eye, EyeOff, Shield, Settings as Cog } from "lucide-react";

export default function Settings() {
  const [apiKey, setApiKey]     = useState("");
  const [secret, setSecret]     = useState("");
  const [paper, setPaper]       = useState(true);
  const [show, setShow]         = useState(false);
  const [status, setStatus]     = useState(null);
  const [account, setAccount]   = useState(null);
  const [testing, setTesting]   = useState(false);

  useEffect(() => { loadKeys(); }, []);

  async function loadKeys() {
    try {
      const cfg = await (await fetch("/api/config")).json();
      setApiKey(cfg.alpaca?.api_key    || "");
      setPaper(cfg.alpaca?.paper ?? true);
    } catch {}
  }

  async function saveKeys() {
    try {
      const cfg = await (await fetch("/api/config")).json();
      cfg.alpaca = {
        ...cfg.alpaca,
        api_key:    apiKey,
        secret_key: secret || cfg.alpaca?.secret_key,
        paper,
      };
      const res = await fetch("/api/config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      setStatus({ ok: res.ok, msg: res.ok ? "Credentials saved" : "Save failed" });
    } catch (e) { setStatus({ ok: false, msg: e.message }); }
    setTimeout(() => setStatus(null), 3000);
  }

  async function testConn() {
    setTesting(true); setAccount(null);
    try {
      const res = await fetch("/api/account");
      if (res.ok) {
        setAccount(await res.json());
        setStatus({ ok: true, msg: "Connection successful" });
      } else {
        setStatus({ ok: false, msg: "Connection failed — check credentials" });
      }
    } catch { setStatus({ ok: false, msg: "Cannot reach engine" }); }
    setTesting(false);
    setTimeout(() => setStatus(null), 5000);
  }

  async function resetSystem() {
    if (!window.confirm("Stop engine and clear all open state?")) return;
    await fetch("/api/engine/stop", { method: "POST" });
    setStatus({ ok: true, msg: "System reset" });
    setTimeout(() => setStatus(null), 3000);
  }

  const f2 = (v) => v == null ? "—" : `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: 24 }}
         className="flex flex-col gap-5">

      <div className="flex items-center gap-2">
        <Cog size={15} className="accent" />
        <span className="accent font-bold" style={{ fontSize: 13, letterSpacing: ".12em" }}>SYSTEM SETTINGS</span>
      </div>

      {status && (
        <div className={`flex items-center gap-2 panel`}
             style={{ padding: "8px 12px", borderColor: status.ok ? "#00e67640" : "#ff335540",
                      background: status.ok ? "#00e67610" : "#ff335510",
                      color: status.ok ? "#00e676" : "#ff3355", fontSize: 12 }}>
          {status.ok ? <CheckCircle size={12}/> : <AlertTriangle size={12}/>}
          {status.msg}
        </div>
      )}

      {/* API credentials */}
      <Card title="ALPACA API CREDENTIALS" icon={<Key size={12} className="accent" />}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 panel"
               style={{ padding: "7px 12px", fontSize: 11,
                        borderColor: paper ? "#00e67640" : "#ff335540",
                        background:  paper ? "#00e67608" : "#ff335508",
                        color:       paper ? "#00e676"   : "#ff3355" }}>
            <Shield size={11}/>
            {paper ? "PAPER TRADING — Simulated money, no real risk"
                   : "⚠ LIVE TRADING — Real money at risk"}
          </div>

          <Row label="Mode">
            <div className="flex gap-2">
              {[["Paper", true], ["Live", false]].map(([lbl, val]) => (
                <button key={lbl} onClick={() => setPaper(val)}
                        className="btn"
                        style={{ borderColor: paper === val ? (val ? "#00e676" : "#ff3355") : "#1a2740",
                                 color:       paper === val ? (val ? "#00e676" : "#ff3355") : "#3a4e6a" }}>
                  {lbl}
                </button>
              ))}
            </div>
          </Row>

          <Row label="API Key">
            <input className="inp" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="PKXX…" />
          </Row>

          <Row label="Secret Key">
            <div style={{ position: "relative" }}>
              <input className="inp" type={show ? "text" : "password"}
                     value={secret} onChange={(e) => setSecret(e.target.value)}
                     placeholder="Leave blank to keep existing" style={{ paddingRight: 28 }} />
              <button onClick={() => setShow(!show)}
                      style={{ position: "absolute", right: 8, top: 5, color: "#3a4e6a", background: "none", border: "none", cursor: "pointer" }}>
                {show ? <EyeOff size={13}/> : <Eye size={13}/>}
              </button>
            </div>
          </Row>

          <div className="flex gap-2 mt-1">
            <button className="btn btn-cyan"  onClick={saveKeys}>Save</button>
            <button className="btn btn-cyan"  onClick={testConn} disabled={testing}>
              <RefreshCw size={11} className={testing ? "spin" : ""}/> Test Connection
            </button>
          </div>

          {account && (
            <div className="panel" style={{ padding: 12, marginTop: 8 }}>
              <div className="accent font-bold" style={{ fontSize: 10, letterSpacing: ".1em", marginBottom: 10 }}>
                ACCOUNT
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px" }}>
                {[
                  ["Status",       account.status,               "bull"],
                  ["Equity",       f2(account.equity),           ""],
                  ["Cash",         f2(account.cash),             ""],
                  ["Buying Power", f2(account.buying_power),     ""],
                  ["Day Trades",   account.daytrade_count,       ""],
                  ["PDT",          account.pdt ? "Yes" : "No",  account.pdt ? "warn" : "bull"],
                ].map(([k, v, cls]) => (
                  <div key={k} className="flex justify-between">
                    <span className="dim" style={{ fontSize: 11 }}>{k}</span>
                    <span className={`font-semibold ${cls}`} style={{ fontSize: 11 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* System control */}
      <Card title="SYSTEM CONTROL" icon={<RefreshCw size={12} className="accent" />}>
        <div className="flex gap-2">
          <button className="btn btn-red"  onClick={resetSystem}><Trash2 size={11}/> RESET SYSTEM</button>
          <button className="btn btn-cyan" onClick={() => window.location.reload()}><RefreshCw size={11}/> RELOAD UI</button>
        </div>
      </Card>

      <Card title="ABOUT" icon={<Cog size={12} className="accent" />}>
        <div className="flex flex-col gap-1 dim" style={{ fontSize: 11 }}>
          <div>The RoBot — Algorithmic Trading Station</div>
          <div>Strategy: EMA Cross · VWAP · RSI · RVOL · ATR Trailing</div>
          <div>Data: Alpaca Markets Streaming API</div>
          <div style={{ marginTop: 4, fontSize: 10, color: "#1a2740" }}>v2.0.0</div>
        </div>
      </Card>
    </div>
  );
}

function Card({ title, icon, children }) {
  return (
    <div className="panel" style={{ padding: 16 }}>
      <div className="flex items-center gap-2 dim font-bold"
           style={{ fontSize: 10, letterSpacing: ".12em", marginBottom: 14,
                    paddingBottom: 10, borderBottom: "1px solid #1a2740" }}>
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center gap-3">
      <span className="dim" style={{ fontSize: 11, width: 80, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
