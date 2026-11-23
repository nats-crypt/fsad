import { useState, useEffect } from 'react';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Radio, Plane, X, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { AIRPORT_COORDS, interpolatePosition } from '../../lib/airports';
import { formatTime } from '../../lib/utils';
import { cn } from '../../lib/utils';

interface BoardFlight {
  id: string;
  flightNo: string;
  origin: { code: string; city: string };
  destination: { code: string; city: string };
  departAt: string;
  arriveAt: string;
  status: string;
}

function planeIcon(heading: number, inAir: boolean, focused: boolean): L.DivIcon {
  const color = focused ? '#f59e0b' : inAir ? '#5b21b6' : '#6b7280';
  const size = focused ? 38 : 30;
  const shadow = focused
    ? 'drop-shadow(0 0 8px rgba(245,158,11,0.8)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
    : 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))';
  return L.divIcon({
    className: '',
    html: `<div style="transform:rotate(${heading}deg);width:${size + 4}px;height:${size + 4}px;display:flex;align-items:center;justify-content:center;filter:${shadow}">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="${size}" height="${size}">
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>
    </div>`,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
  });
}

function airportDot(label: string, highlighted: boolean): L.DivIcon {
  const bg = highlighted ? '#f59e0b' : '#a78bfa';
  const ring = highlighted ? '#f59e0b' : '#5b21b6';
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="width:${highlighted ? 14 : 10}px;height:${highlighted ? 14 : 10}px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 0 0 2px ${ring}${highlighted ? ',0 0 8px rgba(245,158,11,0.6)' : ''}"></div>
      <span style="font-family:monospace;font-size:${highlighted ? 11 : 10}px;font-weight:bold;color:${bg};white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.8)">${label}</span>
    </div>`,
    iconSize: [40, 28],
    iconAnchor: [20, 5],
  });
}

/** Flies the map to the selected flight's route bounds, or resets to India overview. */
function MapController({ flight }: { flight: BoardFlight | null }) {
  const map = useMap();
  useEffect(() => {
    if (!flight) {
      map.flyTo([20.5, 80.0], 5, { duration: 1 });
      return;
    }
    const o = AIRPORT_COORDS[flight.origin.code];
    const d = AIRPORT_COORDS[flight.destination.code];
    if (!o || !d) return;
    const bounds = L.latLngBounds([[o.lat, o.lng], [d.lat, d.lng]]);
    map.flyToBounds(bounds, { padding: [80, 80], duration: 1.2, maxZoom: 8 });
  }, [flight, map]);
  return null;
}

export default function LiveMap() {
  const [now, setNow] = useState(Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2_000);
    return () => clearInterval(id);
  }, []);

  const { data: flights, dataUpdatedAt } = useQuery<BoardFlight[]>({
    queryKey: ['board-flights'],
    queryFn: () => api.get<BoardFlight[]>('/flights/board'),
    refetchInterval: 60_000,
  });

  const mapped = (flights ?? []).filter(
    f => AIRPORT_COORDS[f.origin.code] && AIRPORT_COORDS[f.destination.code],
  );

  const inAir = mapped.filter(f => new Date(f.departAt).getTime() <= now && new Date(f.arriveAt).getTime() > now);
  const scheduled = mapped.filter(f => new Date(f.departAt).getTime() > now);
  const selectedFlight = mapped.find(f => f.id === selectedId) ?? null;

  // Airports to show (all, or just the focused flight's pair)
  const airportCodes = new Set<string>();
  if (selectedFlight) {
    airportCodes.add(selectedFlight.origin.code);
    airportCodes.add(selectedFlight.destination.code);
  } else {
    mapped.forEach(f => { airportCodes.add(f.origin.code); airportCodes.add(f.destination.code); });
  }

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  function toggleSelect(id: string) {
    setSelectedId(prev => (prev === id ? null : id));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-heading tracking-widest uppercase text-gold mb-1">Operations</p>
          <h1 className="section-title flex items-center gap-2">
            <Radio className="w-7 h-7 text-gold" />
            Live Flight Map
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {selectedFlight && (
            <button
              className="btn-ghost btn-sm flex items-center gap-1.5"
              onClick={() => setSelectedId(null)}
            >
              <X className="w-3.5 h-3.5" />
              Show All
            </button>
          )}
          <span className="text-xs text-runway font-mono">Updated {lastUpdated}</span>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card border border-sky-light/20 p-4 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse flex-shrink-0" />
          <div>
            <p className="text-xs text-runway uppercase tracking-wider">In Air</p>
            <p className="font-heading text-2xl font-bold text-cloud">{inAir.length}</p>
          </div>
        </div>
        <div className="card border border-sky-light/20 p-4 flex items-center gap-3">
          <Plane className="w-4 h-4 text-gold flex-shrink-0" />
          <div>
            <p className="text-xs text-runway uppercase tracking-wider">Scheduled</p>
            <p className="font-heading text-2xl font-bold text-cloud">{scheduled.length}</p>
          </div>
        </div>
        <div className="card border border-sky-light/20 p-4 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-gold flex-shrink-0" />
          <div>
            <p className="text-xs text-runway uppercase tracking-wider">Total Tracked</p>
            <p className="font-heading text-2xl font-bold text-cloud">{mapped.length}</p>
          </div>
        </div>
      </div>

      {/* Focused flight detail card */}
      {selectedFlight && (() => {
        const pos = interpolatePosition(selectedFlight.origin.code, selectedFlight.destination.code, selectedFlight.departAt, selectedFlight.arriveAt);
        const isFlying = pos ? pos.pct > 0 && pos.pct < 1 : false;
        return (
          <div className="card border border-gold/40 p-4 flex items-center gap-6 animate-fade-up">
            <div className="flex items-center gap-2">
              <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', isFlying ? 'bg-violet-500 animate-pulse' : 'bg-gold/60')} />
              <span className="font-mono text-gold font-bold text-lg">{selectedFlight.flightNo}</span>
            </div>
            <div className="font-heading text-cloud">
              {selectedFlight.origin.city} ({selectedFlight.origin.code})
              <span className="text-gold mx-2">→</span>
              {selectedFlight.destination.city} ({selectedFlight.destination.code})
            </div>
            <div className="text-sm text-runway">
              {formatTime(selectedFlight.departAt)} – {formatTime(selectedFlight.arriveAt)}
            </div>
            {pos && (
              <div className="ml-auto flex items-center gap-3">
                <div className="w-32 h-1.5 rounded-full bg-sky-light/20 overflow-hidden">
                  <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${Math.round(pos.pct * 100)}%` }} />
                </div>
                <span className="text-xs font-mono text-gold w-14 text-right">
                  {isFlying ? `${Math.round(pos.pct * 100)}%` : pos.pct === 0 ? 'Boarding' : 'Landed'}
                </span>
              </div>
            )}
            <button className="btn-icon btn-ghost" onClick={() => setSelectedId(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })()}

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-sky-light/20">
        <MapContainer
          center={[20.5, 80.0]}
          zoom={5}
          minZoom={4}
          maxZoom={10}
          style={{ height: '540px', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapController flight={selectedFlight} />

          {/* Airport dots — only for visible flights */}
          {[...airportCodes].map(code => {
            const a = AIRPORT_COORDS[code];
            const highlighted = !!selectedFlight && (code === selectedFlight.origin.code || code === selectedFlight.destination.code);
            return (
              <Marker key={code} position={[a.lat, a.lng]} icon={airportDot(code, highlighted)}>
                <Tooltip direction="top" offset={[0, -12]}>
                  <strong>{code}</strong> — {a.city}
                </Tooltip>
              </Marker>
            );
          })}

          {/* Each flight */}
          {mapped.map(f => {
            const pos = interpolatePosition(f.origin.code, f.destination.code, f.departAt, f.arriveAt);
            if (!pos) return null;
            const origin = AIRPORT_COORDS[f.origin.code];
            const dest = AIRPORT_COORDS[f.destination.code];
            const originPt: [number, number] = [origin.lat, origin.lng];
            const destPt: [number, number] = [dest.lat, dest.lng];
            const planePt: [number, number] = [pos.lat, pos.lng];
            const isFlying = pos.pct > 0 && pos.pct < 1;
            const isFocused = f.id === selectedId;
            // Dim unfocused flights when something is selected
            const dimmed = !!selectedId && !isFocused;

            return (
              <React.Fragment key={f.id}>
                {/* Full route — dashed */}
                <Polyline
                  positions={[originPt, destPt]}
                  pathOptions={{
                    color: isFocused ? '#f59e0b' : '#7c3aed',
                    weight: isFocused ? 2 : 1.5,
                    dashArray: '5 6',
                    opacity: dimmed ? 0.1 : isFocused ? 0.6 : 0.35,
                  }}
                />

                {/* Flown portion — solid */}
                {isFlying && (
                  <Polyline
                    positions={[originPt, planePt]}
                    pathOptions={{
                      color: isFocused ? '#f59e0b' : '#5b21b6',
                      weight: isFocused ? 4 : 3,
                      opacity: dimmed ? 0.1 : 1,
                    }}
                  />
                )}

                {/* Plane marker — click to focus */}
                <Marker
                  position={planePt}
                  icon={planeIcon(pos.heading, isFlying, isFocused)}
                  opacity={dimmed ? 0.2 : 1}
                  eventHandlers={{ click: () => toggleSelect(f.id) }}
                >
                  <Tooltip direction="top" offset={[0, -20]}>
                    <div style={{ minWidth: 150 }}>
                      <div style={{ fontWeight: 'bold', fontSize: 13 }}>{f.flightNo}</div>
                      <div style={{ fontSize: 11, marginTop: 2 }}>
                        {f.origin.code} → {f.destination.code}
                      </div>
                      <div style={{ fontSize: 11, marginTop: 2, color: '#a78bfa' }}>
                        {isFlying
                          ? `${Math.round(pos.pct * 100)}% complete`
                          : pos.pct === 0
                          ? `Departs ${formatTime(f.departAt)}`
                          : 'Arrived'}
                      </div>
                      <div style={{ fontSize: 10, marginTop: 4, color: '#6b7280' }}>
                        Click to focus
                      </div>
                    </div>
                  </Tooltip>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>

      {/* Flight list */}
      {mapped.length > 0 && (
        <div className="card border border-sky-light/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-sky-light/20 flex items-center justify-between">
            <h3 className="font-heading text-xs tracking-widest uppercase text-runway">
              {selectedId ? 'Click another flight to focus · ' : ''} All Flights
            </h3>
            {selectedId && (
              <button className="text-xs text-runway hover:text-cloud" onClick={() => setSelectedId(null)}>
                Clear selection
              </button>
            )}
          </div>
          <div className="divide-y divide-sky-light/10">
            {[...mapped].sort((a, b) => (b.id === selectedId ? 1 : 0) - (a.id === selectedId ? 1 : 0)).map(f => {
              const pos = interpolatePosition(f.origin.code, f.destination.code, f.departAt, f.arriveAt);
              const isFlying = pos ? pos.pct > 0 && pos.pct < 1 : false;
              const isFocused = f.id === selectedId;
              const dimmed = !!selectedId && !isFocused;

              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggleSelect(f.id)}
                  className={cn(
                    'w-full flex items-center gap-4 px-4 py-3 text-left transition-colors',
                    isFocused
                      ? 'bg-gold/10 border-l-2 border-gold'
                      : 'hover:bg-sky-light/10 border-l-2 border-transparent',
                    dimmed && 'opacity-40',
                  )}
                >
                  <span className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    isFlying ? 'bg-violet-500 animate-pulse' : 'bg-gold/60',
                  )} />
                  <span className={cn('font-mono font-bold w-20', isFocused ? 'text-gold' : 'text-gold/80')}>
                    {f.flightNo}
                  </span>
                  <span className="font-heading text-cloud text-sm">
                    {f.origin.code} → {f.destination.code}
                  </span>
                  <span className="text-xs text-runway">
                    {f.origin.city} → {f.destination.city}
                  </span>
                  <span className="text-xs text-runway ml-auto">
                    {formatTime(f.departAt)} – {formatTime(f.arriveAt)}
                  </span>
                  <span className="text-xs font-mono w-28 text-right">
                    {isFlying
                      ? <span className="text-violet-400">{Math.round((pos?.pct ?? 0) * 100)}% en route</span>
                      : pos?.pct === 0
                      ? <span className="text-gold/70">Scheduled</span>
                      : <span className="text-runway">Arrived</span>}
                  </span>
                  <ChevronRight className={cn('w-3.5 h-3.5 flex-shrink-0 transition-colors', isFocused ? 'text-gold' : 'text-runway/40')} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mapped.length === 0 && (
        <div className="card p-12 text-center border-dashed border-sky-light/20">
          <Radio className="w-10 h-10 text-runway/30 mx-auto mb-3" />
          <p className="text-runway">No active flights right now</p>
        </div>
      )}
    </div>
  );
}
