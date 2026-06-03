import { create } from "zustand";

const useStore = create((set) => ({
  state:       "STOPPED",
  scanMode:    "IDLE",
  lastError:   "",
  account:     null,
  positions:   [],
  scanResults: [],
  currentScan: "",
  tradeLog:    [],
  dailyPnl:    0,
  connected:   false,
  tab:         "scanner",
  feedFilter:  "ALL",   // ALL | BUY | SKIP | HOLDINGS

  setTab:        (tab)    => set({ tab }),
  setConnected:  (v)      => set({ connected: v }),
  setFeedFilter: (filter) => set({ feedFilter: filter }),

  onMessage: (msg) => {
    const { type, data } = msg;
    switch (type) {
      case "init":
        set({
          state:       data.state,
          scanMode:    data.scan_mode    || "IDLE",
          lastError:   data.last_error   || "",
          positions:   data.positions    || [],
          scanResults: (data.scan_results || []).map(r => ({ ...r })),
          currentScan: data.current_scan || "",
          dailyPnl:    data.daily_pnl    || 0,
        });
        break;
      case "engine_state":
        set({ state: data.state, scanMode: data.scan_mode || "IDLE", lastError: data.error || "" });
        break;
      case "account_update":
        set({ account: data });
        break;
      case "positions_update":
        set({ positions: data });
        break;
      case "position_update":
        set((s) => {
          const list = [...s.positions];
          const i = list.findIndex((p) => p.symbol === data.symbol);
          if (i >= 0) list[i] = data; else list.push(data);
          return { positions: list };
        });
        break;
      case "scan_update":
        set((s) => {
          const list = [...s.scanResults];
          const i = list.findIndex((r) => r.symbol === data.symbol);
          if (i >= 0) list[i] = data; else list.unshift(data);
          return { scanResults: list.slice(0, 60), currentScan: data.symbol };
        });
        break;
      case "trade_closed":
        set((s) => ({
          tradeLog:  [data, ...s.tradeLog].slice(0, 200),
          dailyPnl:  s.dailyPnl + (data.pl || 0),
          positions: s.positions.filter((p) => p.symbol !== data.symbol),
        }));
        break;
      case "kill_switch":
        set({ state: "KILL_SWITCH" });
        break;
    }
  },
}));

export default useStore;
