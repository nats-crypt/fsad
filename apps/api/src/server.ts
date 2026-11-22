import "./env.js";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { createApp } from "./app.js";
import { startNotificationScheduler } from "./lib/notifications.js";
import { fetchAircraftPosition } from "./lib/opensky.js";

const port = process.env.PORT ?? 4000;
const app = createApp();
const httpServer = createServer(app);

// ─── WebSocket server for real-time flight tracking ──────────────────────────
const wss = new WebSocketServer({ server: httpServer, path: "/ws/track" });

wss.on("connection", (ws) => {
  let interval: ReturnType<typeof setInterval> | null = null;

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as { type: string; callsign?: string };
      if (msg.type === "track" && msg.callsign) {
        // Clear any existing poll for this connection
        if (interval) clearInterval(interval);

        const callsign = msg.callsign.trim().toUpperCase();

        async function poll() {
          if (ws.readyState !== ws.OPEN) {
            if (interval) clearInterval(interval);
            return;
          }
          const pos = await fetchAircraftPosition(callsign);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: "position", callsign, data: pos }));
          }
        }

        poll(); // immediate first fetch
        interval = setInterval(poll, 30_000); // then every 30s
      } else if (msg.type === "stop") {
        if (interval) { clearInterval(interval); interval = null; }
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on("close", () => {
    if (interval) clearInterval(interval);
  });
});

// ─── Start notification scheduler ────────────────────────────────────────────
startNotificationScheduler();

httpServer.listen(port, () => {
  console.log(`Horizon API listening on http://localhost:${port}`);
  console.log(`WebSocket tracking on ws://localhost:${port}/ws/track`);
});
