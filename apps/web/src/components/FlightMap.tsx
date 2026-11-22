import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { AIRPORT_COORDS, interpolatePosition } from '../lib/airports';

interface LivePosition {
  lat: number;
  lng: number;
  heading: number;
  pct: number;
  source: 'simulated' | 'live';
  altitude?: number;
  velocity?: number;
  onGround?: boolean;
}

function planeIcon(heading: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="transform:rotate(${heading}deg);width:36px;height:36px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#5b21b6" width="34" height="34">
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function airportDot(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:#5b21b6;border:2.5px solid #fff;box-shadow:0 0 0 2px #5b21b6"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length >= 2) {
      map.fitBounds(L.latLngBounds(positions), { padding: [50, 50], maxZoom: 8 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export interface FlightMapProps {
  originCode: string;
  destCode: string;
  departAt: string;
  arriveAt: string;
  callsign?: string;
  height?: number;
}

export default function FlightMap({
  originCode,
  destCode,
  departAt,
  arriveAt,
  callsign,
  height = 380,
}: FlightMapProps) {
  const [position, setPosition] = useState<LivePosition | null>(null);
  const liveRef = useRef(false);

  const origin = AIRPORT_COORDS[originCode];
  const dest = AIRPORT_COORDS[destCode];

  // Simulated position — ticks every 2s for visible movement, yields to live data
  useEffect(() => {
    function tick() {
      if (liveRef.current) return;
      const p = interpolatePosition(originCode, destCode, departAt, arriveAt);
      if (p) setPosition({ ...p, source: 'simulated' });
    }
    tick();
    const id = setInterval(tick, 2_000);
    return () => clearInterval(id);
  }, [originCode, destCode, departAt, arriveAt]);

  // WebSocket live tracking
  useEffect(() => {
    if (!callsign) return;
    const wsUrl = `ws://${window.location.hostname}:4000/ws/track`;
    const ws = new WebSocket(wsUrl);

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'track', callsign }));
    });

    ws.addEventListener('message', (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as {
          type: string;
          data: {
            latitude: number;
            longitude: number;
            heading: number;
            altitude: number;
            velocity: number;
            onGround: boolean;
          } | null;
        };
        if (msg.type === 'position' && msg.data && !msg.data.onGround) {
          liveRef.current = true;
          setPosition({
            lat: msg.data.latitude,
            lng: msg.data.longitude,
            heading: msg.data.heading ?? 0,
            pct: -1,
            source: 'live',
            altitude: msg.data.altitude,
            velocity: msg.data.velocity,
          });
        }
      } catch {
        // ignore
      }
    });

    return () => {
      liveRef.current = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stop' }));
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener('open', () => {
          ws.send(JSON.stringify({ type: 'stop' }));
          ws.close();
        });
      }
    };
  }, [callsign]);

  if (!origin || !dest) {
    return (
      <div className="card p-4 text-sm text-runway">
        Map unavailable — airport coordinates not found.
      </div>
    );
  }

  const originPt: [number, number] = [origin.lat, origin.lng];
  const destPt: [number, number] = [dest.lat, dest.lng];
  const fullRoute: [number, number][] = [originPt, destPt];

  // Split polylines: flown path (solid) + remaining path (dashed)
  const aircraftPt: [number, number] | null = position
    ? [position.lat, position.lng]
    : null;
  const flownPath: [number, number][] = aircraftPt ? [originPt, aircraftPt] : [];
  const remainingPath: [number, number][] = aircraftPt ? [aircraftPt, destPt] : fullRoute;

  return (
    <div className="relative rounded-xl overflow-hidden border border-sky-light/20">
      <MapContainer
        center={[(origin.lat + dest.lat) / 2, (origin.lng + dest.lng) / 2]}
        zoom={6}
        minZoom={5}
        maxZoom={12}
        maxBounds={[[6, 65], [38, 100]]}
        style={{ height: `${height}px`, width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Remaining route — dashed, mid purple */}
        <Polyline
          positions={remainingPath}
          pathOptions={{ color: '#7c3aed', weight: 3, dashArray: '8 5', opacity: 0.65 }}
        />

        {/* Flown path — solid bold dark purple */}
        {flownPath.length === 2 && (
          <Polyline
            positions={flownPath}
            pathOptions={{ color: '#5b21b6', weight: 4, opacity: 1 }}
          />
        )}

        {/* Origin dot */}
        <Marker position={originPt} icon={airportDot()}>
          <Tooltip permanent direction="top" offset={[0, -8]}>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px' }}>
              {originCode}
            </span>
          </Tooltip>
        </Marker>

        {/* Destination dot */}
        <Marker position={destPt} icon={airportDot()}>
          <Tooltip permanent direction="top" offset={[0, -8]}>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px' }}>
              {destCode}
            </span>
          </Tooltip>
        </Marker>

        {/* Aircraft marker */}
        {position && !position.onGround && aircraftPt && (
          <Marker position={aircraftPt} icon={planeIcon(position.heading)} />
        )}

        <FitBounds positions={fullRoute} />
      </MapContainer>

      {/* Status overlay */}
      <div className="absolute bottom-3 left-3 z-[1000] glass rounded-lg px-3 py-1.5 text-xs font-mono flex items-center gap-3">
        {position?.source === 'live' ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400">LIVE</span>
            </span>
            {position.altitude != null && (
              <span className="text-runway">{Math.round(position.altitude / 30.48) * 100} ft</span>
            )}
            {position.velocity != null && (
              <span className="text-runway">{Math.round(position.velocity * 1.94384)} kts</span>
            )}
          </>
        ) : position ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              <span className="text-violet-400">SIMULATED</span>
            </span>
            {position.pct >= 0 && (
              <span className="text-runway">{Math.round(position.pct * 100)}% complete</span>
            )}
          </>
        ) : (
          <span className="text-runway/60">Calculating…</span>
        )}
      </div>
    </div>
  );
}
