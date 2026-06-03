import { useEffect, useRef } from "react";
import useStore from "../store/useStore";

export function useWS() {
  const ws    = useRef(null);
  const timer = useRef(null);
  const { onMessage, setConnected } = useStore();

  function connect() {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url   = `${proto}://${window.location.host}/ws`;
    try {
      ws.current = new WebSocket(url);
      ws.current.onopen    = () => { setConnected(true); clearTimeout(timer.current); };
      ws.current.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch {} };
      ws.current.onclose   = () => { setConnected(false); timer.current = setTimeout(connect, 3000); };
      ws.current.onerror   = () => { ws.current?.close(); };
    } catch {}
  }

  useEffect(() => {
    connect();
    return () => { clearTimeout(timer.current); ws.current?.close(); };
  }, []);
}
