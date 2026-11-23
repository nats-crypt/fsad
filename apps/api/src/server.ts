import "./env.js";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { createApp } from "./app.js";
import { startNotificationScheduler } from "./lib/notifications.js";
import { fetchAircraftPosition } from "./lib/opensky.js";

// Catch unhandled rejections / exceptions so Railway doesn't restart on transient errors
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

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
        if (interval) clearInterval(interval);

        const callsign = msg.callsign.trim().toUpperCase();

        async function poll() {
          if (ws.readyState !== ws.OPEN) {
            if (interval) clearInterval(interval);
            return;
          }
          try {
            const pos = await fetchAircraftPosition(callsign);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: "position", callsign, data: pos }));
            }
          } catch (err) {
            console.error("[ws/track] poll error:", err);
          }
        }

        poll();
        interval = setInterval(poll, 30_000);
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

  ws.on("error", (err) => {
    console.error("[ws/track] socket error:", err);
  });
});

// ─── Start notification scheduler ────────────────────────────────────────────
startNotificationScheduler();

httpServer.listen(port, () => {
  console.log(`Horizon API listening on http://localhost:${port}`);
  console.log(`WebSocket tracking on ws://localhost:${port}/ws/track`);
});
