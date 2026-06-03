import React from "react";
import { Toaster, toast } from "react-hot-toast";
import { ScanLine, BarChart2, FileCode, Settings as Cog } from "lucide-react";
import TopBar from "./components/TopBar";
import Scanner from "./components/Scanner";
import Charts from "./components/Charts";
import StrategyEditor from "./components/StrategyEditor";
import Settings from "./components/Settings";
import { useWS } from "./hooks/useWS";
import useStore from "./store/useStore";

const TABS = [
  { id: "scanner",  label: "TRADE SCANNER",   Icon: ScanLine  },
  { id: "charts",   label: "CHARTS",           Icon: BarChart2 },
  { id: "strategy", label: "STRATEGY EDITOR",  Icon: FileCode  },
  { id: "settings", label: "SETTINGS",         Icon: Cog       },
];

const TOAST = { style: { background: "#0c1120", color: "#c0d0e8",
                          border: "1px solid #1a2740", fontFamily: "JetBrains Mono,monospace",
                          fontSize: 12, borderRadius: 4 } };

export default function App() {
  useWS();
  const { tab, setTab, state } = useStore();

  async function onStart() {
    const res = await fetch("/api/engine/start", { method: "POST" });
    if (res.ok) toast.success("Engine started", TOAST);
    else        toast.error("Failed to start engine", TOAST);
  }

  async function onStop() {
    const res = await fetch("/api/engine/stop", { method: "POST" });
    if (res.ok) toast.success("Engine stopped", TOAST);
    else        toast.error("Failed to stop engine", TOAST);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#07090f" }}>
      <Toaster position="bottom-right" />

      <TopBar onStart={onStart} onStop={onStop} />

      {/* tab bar */}
      <div style={{ display: "flex", background: "#05070d",
                    borderBottom: "1px solid #1a2740", flexShrink: 0 }}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={`tab ${tab === id ? "active" : ""}`}
                  onClick={() => setTab(id)}>
            <Icon size={12} /> {label}
          </button>
        ))}
        {state === "KILL_SWITCH" && (
          <div className="flex items-center px-4 warn font-bold pulse"
               style={{ fontSize: 11, marginLeft: "auto", letterSpacing: ".08em" }}>
            ⚠ KILL SWITCH — DAILY LOSS LIMIT REACHED
          </div>
        )}
      </div>

      {/* content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "scanner"  && <Scanner />}
        {tab === "charts"   && <Charts />}
        {tab === "strategy" && <StrategyEditor />}
        {tab === "settings" && <Settings />}
      </div>
    </div>
  );
}
