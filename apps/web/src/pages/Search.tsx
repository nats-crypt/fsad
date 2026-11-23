import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Search as SearchIcon, Zap, MapPin, Calendar, Users, Filter,
  Loader2, Sparkles, AlertCircle, ArrowUpDown, Clock, Wallet,
  Gauge, ChevronRight, ArrowRight, SlidersHorizontal, X,
} from 'lucide-react';
import { api } from '../lib/api';
import FlightCard from '../components/FlightCard';
import type { Flight, ParsedSearch } from '../types';
import { cn, todayIST, formatCurrency, formatTime, getDuration } from '../lib/utils';

const AIRPORTS = [
  { code: 'DEL', city: 'Delhi' },
  { code: 'BOM', city: 'Mumbai' },
  { code: 'BLR', city: 'Bangalore' },
  { code: 'HYD', city: 'Hyderabad' },
  { code: 'MAA', city: 'Chennai' },
  { code: 'CCU', city: 'Kolkata' },
];

type SortKey = 'cheapest' | 'fastest' | 'earliest' | 'latest';
type TimeSlot = 'any' | 'morning' | 'afternoon' | 'evening' | 'night';

const TIME_SLOTS: { key: TimeSlot; label: string; range: string; hours: [number, number] }[] = [
  { key: 'morning',   label: 'Morning',   range: '06–12',  hours: [6,  12] },
  { key: 'afternoon', label: 'Afternoon', range: '12–17',  hours: [12, 17] },
  { key: 'evening',   label: 'Evening',   range: '17–21',  hours: [17, 21] },
  { key: 'night',     label: 'Night',     range: '21–06',  hours: [21, 30] },
];

function getHourIST(dateStr: string) {
  const d = new Date(dateStr);
  return ((d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440) / 60;
}

function flightDurationMin(f: Flight) {
  return (new Date(f.arriveAt).getTime() - new Date(f.departAt).getTime()) / 60000;
}

function matchesSlot(hour: number, slot: TimeSlot): boolean {
  if (slot === 'any') return true;
  const { hours } = TIME_SLOTS.find(s => s.key === slot)!;
  if (hours[1] > 24) return hour >= hours[0] || hour < hours[1] - 24;
  return hour >= hours[0] && hour < hours[1];
}

function applyFiltersAndSort(
  flights: Flight[],
  sort: SortKey,
  depSlot: TimeSlot,
  arrSlot: TimeSlot,
  maxFare: number,
): Flight[] {
  let result = flights.filter(f => {
    if (f.baseFare > maxFare) return false;
    if (!matchesSlot(getHourIST(f.departAt), depSlot)) return false;
    if (!matchesSlot(getHourIST(f.arriveAt), arrSlot)) return false;
    return true;
  });
  result = [...result].sort((a, b) => {
    if (sort === 'cheapest') return a.baseFare - b.baseFare;
    if (sort === 'fastest')  return flightDurationMin(a) - flightDurationMin(b);
    if (sort === 'earliest') return new Date(a.departAt).getTime() - new Date(b.departAt).getTime();
    if (sort === 'latest')   return new Date(b.departAt).getTime() - new Date(a.departAt).getTime();
    return 0;
  });
  return result;
}

// Compact flight row for round-trip selection
function FlightRow({ flight, selected, onSelect, pax, label }: {
  flight: Flight; selected: boolean; onSelect: () => void; pax: number; label?: string;
}) {
  const dur = getDuration(flight.departAt, flight.arriveAt);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-xl border px-4 py-3 transition-all',
        selected
          ? 'border-gold/60 bg-gold/5 ring-1 ring-gold/20'
          : 'border-sky-light/20 hover:border-sky-light/40 hover:bg-sky-mid/20'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          {label && (
            <span className={cn('badge text-xs flex-shrink-0', label === 'Outbound' ? 'badge-blue' : 'badge-gold')}>
              {label}
            </span>
          )}
          <span className="font-heading font-bold text-cloud text-lg">{formatTime(flight.departAt)}</span>
          <span className="text-runway/50 text-xs">{dur}</span>
          <span className="font-heading font-bold text-cloud text-lg">{formatTime(flight.arriveAt)}</span>
          <span className="text-xs text-runway/60 font-mono">{flight.flightNo}</span>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-heading font-bold text-gold">{formatCurrency(flight.baseFare * pax)}</p>
          {pax > 1 && <p className="text-xs text-runway/50">{formatCurrency(flight.baseFare)}/pax</p>}
        </div>
      </div>
      {selected && (
        <div className="mt-1 text-xs text-jade flex items-center gap-1">
          <span>✓ Selected</span>
          <span className="text-runway/40">· {flight.aircraft.model} · {flight.seatsLeft} seats left</span>
        </div>
      )}
    </button>
  );
}

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const [nlMode, setNlMode] = useState(!!sp.get('q'));
  const [nlQuery, setNlQuery] = useState(sp.get('q') ?? '');

  const [origin, setOrigin] = useState(sp.get('origin') ?? '');
  const [destination, setDestination] = useState(sp.get('destination') ?? '');
  const today = todayIST();
  const [date, setDate] = useState(() => { const d = sp.get('date') ?? today; return d < today ? today : d; });
  const [pax, setPax] = useState(Number(sp.get('pax') ?? 1));
  const [tripType, setTripType] = useState<'one-way' | 'round-trip'>(sp.get('returnDate') ? 'round-trip' : 'one-way');
  const [returnDate, setReturnDate] = useState(() => { const d = sp.get('returnDate') ?? ''; return d < today ? '' : d; });

  // Filters & sort
  const [sort, setSort] = useState<SortKey>('cheapest');
  const [depSlot, setDepSlot] = useState<TimeSlot>('any');
  const [arrSlot, setArrSlot] = useState<TimeSlot>('any');
  const [retDepSlot, setRetDepSlot] = useState<TimeSlot>('any');
  const [showFilters, setShowFilters] = useState(false);

  // Round-trip selection
  const [selectedOutbound, setSelectedOutbound] = useState<Flight | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<Flight | null>(null);

  const flightQuery = useQuery<Flight[]>({
    queryKey: ['flights', origin, destination, date, pax],
    queryFn: () => {
      const p = new URLSearchParams();
      if (origin) p.set('origin', origin);
      if (destination) p.set('destination', destination);
      if (date) p.set('date', date);
      p.set('pax', String(pax));
      return api.get<Flight[]>(`/flights?${p}`);
    },
    enabled: !nlMode && date >= today,
    staleTime: 0,
  });

  const returnQuery = useQuery<Flight[]>({
    queryKey: ['flights-return', destination, origin, returnDate, pax],
    queryFn: () => {
      const p = new URLSearchParams();
      if (destination) p.set('origin', destination);
      if (origin) p.set('destination', origin);
      if (returnDate) p.set('date', returnDate);
      p.set('pax', String(pax));
      return api.get<Flight[]>(`/flights?${p}`);
    },
    enabled: !nlMode && tripType === 'round-trip' && !!returnDate && returnDate >= today,
    staleTime: 0,
  });

  const nlMutation = useMutation({
    mutationFn: (text: string) => api.post<{ parsed: ParsedSearch; flights: Flight[] }>('/ai/search', { text }),
    onSuccess: d => setParsedSearch(d.parsed),
  });
  const [parsedSearch, setParsedSearch] = useState<ParsedSearch | null>(null);

  useEffect(() => { if (!nlMode && (origin || destination)) void flightQuery.refetch(); }, []);
  useEffect(() => { const q = sp.get('q'); if (q && nlMode) nlMutation.mutate(q); }, []);

  // Reset selections when query changes
  useEffect(() => { setSelectedOutbound(null); setSelectedReturn(null); }, [date, origin, destination]);
  useEffect(() => { setSelectedReturn(null); }, [returnDate]);

  const rawFlights = nlMode ? (nlMutation.data?.flights ?? []) : (flightQuery.data ?? []);
  const rawReturn  = returnQuery.data ?? [];

  // Compute max fares for range sliders
  const maxOutboundFare = useMemo(() => Math.max(...rawFlights.map(f => f.baseFare), 0), [rawFlights]);
  const maxReturnFare   = useMemo(() => Math.max(...rawReturn.map(f => f.baseFare), 0), [rawReturn]);
  const [fareMax, setFareMax]       = useState(0);
  const [retFareMax, setRetFareMax] = useState(0);
  useEffect(() => { if (maxOutboundFare > 0) setFareMax(maxOutboundFare); }, [maxOutboundFare]);
  useEffect(() => { if (maxReturnFare > 0) setRetFareMax(maxReturnFare); }, [maxReturnFare]);

  const outboundFiltered = useMemo(
    () => applyFiltersAndSort(rawFlights, sort, depSlot, arrSlot, fareMax || Infinity),
    [rawFlights, sort, depSlot, arrSlot, fareMax]
  );
  const returnFiltered = useMemo(
    () => applyFiltersAndSort(rawReturn, sort, retDepSlot, 'any', retFareMax || Infinity),
    [rawReturn, sort, retDepSlot, retFareMax]
  );

  const isLoading  = nlMode ? nlMutation.isPending : flightQuery.isLoading;
  const isError    = nlMode ? nlMutation.isError   : flightQuery.isError;
  const hasSearched = nlMode ? nlMutation.isSuccess || nlMutation.isPending : !flightQuery.isLoading;

  function handleClassicSearch(e: FormEvent) {
    e.preventDefault();
    const safeDate = date < today ? today : date;
    if (safeDate !== date) setDate(safeDate);
    const params: Record<string, string> = { origin, destination, date: safeDate, pax: String(pax) };
    if (tripType === 'round-trip' && returnDate && returnDate >= safeDate) params.returnDate = returnDate;
    setSp(params);
    void flightQuery.refetch();
    if (tripType === 'round-trip' && returnDate) void returnQuery.refetch();
  }

  function handleNlSearch(e: FormEvent) {
    e.preventDefault();
    if (nlQuery.trim()) { setSp({ q: nlQuery }); nlMutation.mutate(nlQuery); }
  }

  function bookRoundTrip() {
    if (!selectedOutbound) return;
    // Navigate to outbound booking; return flight info passed as query param
    const to = selectedReturn
      ? `/book/${selectedOutbound.id}?pax=${pax}&returnFlightId=${selectedReturn.id}`
      : `/book/${selectedOutbound.id}?pax=${pax}`;
    navigate(to);
  }

  const totalRoundTripFare = (selectedOutbound?.baseFare ?? 0) + (selectedReturn?.baseFare ?? 0);

  return (
    <div className="min-h-screen art-deco-bg pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <p className="text-xs font-heading tracking-widest uppercase text-gold mb-1">Flight Search</p>
          <h1 className="section-title">Find Your Flight</h1>
          <div className="gold-line-left w-24 mt-2" />
        </div>

        {/* Search widget */}
        <div className="card border border-sky-light/30 p-5 mb-6 animate-fade-up animate-delay-100">
          {/* Mode toggle */}
          <div className="flex items-center gap-2 mb-5">
            <button onClick={() => setNlMode(false)} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading tracking-wider uppercase transition-all', !nlMode ? 'bg-gold/15 text-gold border border-gold/30' : 'text-runway hover:text-cloud')}>
              <Filter className="w-3.5 h-3.5" /> Classic
            </button>
            <button onClick={() => setNlMode(true)} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading tracking-wider uppercase transition-all', nlMode ? 'bg-gold/15 text-gold border border-gold/30' : 'text-runway hover:text-cloud')}>
              <Sparkles className="w-3.5 h-3.5" /> AI Search
            </button>
          </div>

          {nlMode ? (
            <form onSubmit={handleNlSearch} className="flex gap-3">
              <div className="flex-1 input-group">
                <Zap className="input-icon w-4 h-4 text-gold" />
                <input className="input pl-11" placeholder='e.g. "Morning flight from Delhi to Mumbai this Friday"' value={nlQuery} onChange={e => setNlQuery(e.target.value)} autoFocus />
              </div>
              <button type="submit" className="btn-primary flex-shrink-0" disabled={nlMutation.isPending}>
                {nlMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchIcon className="w-4 h-4" />} Search
              </button>
            </form>
          ) : (
            <form onSubmit={handleClassicSearch}>
              {/* Trip type */}
              <div className="flex items-center gap-2 mb-3">
                {(['one-way', 'round-trip'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setTripType(t)}
                    className={cn('px-3 py-1.5 rounded-lg text-sm font-heading tracking-wide border transition-all capitalize',
                      tripType === t ? 'bg-gold/15 text-gold border-gold/30' : 'text-runway border-sky-light/20 hover:border-sky-light/40'
                    )}>
                    {t.replace('-', ' ')}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="label">From</label>
                  <div className="input-group">
                    <MapPin className="input-icon w-4 h-4" />
                    <select className="input pl-11" value={origin} onChange={e => setOrigin(e.target.value)}>
                      <option value="">Any origin</option>
                      {AIRPORTS.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">To</label>
                  <div className="input-group">
                    <MapPin className="input-icon w-4 h-4" />
                    <select className="input pl-11" value={destination} onChange={e => setDestination(e.target.value)}>
                      <option value="">Any destination</option>
                      {AIRPORTS.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Depart</label>
                  <div className="input-group">
                    <Calendar className="input-icon w-4 h-4" />
                    <input type="date" className="input pl-11" value={date} min={today}
                      onChange={e => { const v = e.target.value; setDate(!v || v < today ? today : v); }}
                      onBlur={e => { if (!e.target.value || e.target.value < today) setDate(today); }} />
                  </div>
                </div>
                {tripType === 'round-trip' ? (
                  <div>
                    <label className="label">Return</label>
                    <div className="input-group">
                      <Calendar className="input-icon w-4 h-4" />
                      <input type="date" className="input pl-11" value={returnDate} min={date || today}
                        onChange={e => { const v = e.target.value; setReturnDate(!v || v < date ? date : v); }}
                        onBlur={e => { if (!e.target.value || e.target.value < date) setReturnDate(date); }} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="label">Passengers</label>
                    <div className="input-group">
                      <Users className="input-icon w-4 h-4" />
                      <input type="number" className="input pl-11" min={1} max={9} value={pax} onChange={e => setPax(Number(e.target.value))} />
                    </div>
                  </div>
                )}
              </div>

              {tripType === 'round-trip' && (
                <div className="mt-3">
                  <label className="label">Passengers</label>
                  <div className="input-group w-40">
                    <Users className="input-icon w-4 h-4" />
                    <input type="number" className="input pl-11" min={1} max={9} value={pax} onChange={e => setPax(Number(e.target.value))} />
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary mt-3">
                <SearchIcon className="w-4 h-4" /> Search Flights
              </button>
            </form>
          )}

          {nlMode && parsedSearch && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-runway font-heading tracking-wide">AI parsed:</span>
              {parsedSearch.origin      && <span className="badge badge-blue">From: {parsedSearch.origin}</span>}
              {parsedSearch.destination && <span className="badge badge-blue">To: {parsedSearch.destination}</span>}
              {parsedSearch.dateFrom    && <span className="badge badge-gray">Date: {parsedSearch.dateFrom}</span>}
              {parsedSearch.timeOfDay   && <span className="badge badge-gray">{parsedSearch.timeOfDay}</span>}
              {parsedSearch.sort        && <span className="badge badge-gold">{parsedSearch.sort}</span>}
            </div>
          )}
        </div>

        {/* Loading / Error */}
        {isLoading && (
          <div className="flex flex-col items-center gap-4 py-16 animate-fade-in">
            <Loader2 className="w-10 h-10 text-gold animate-spin" />
            <p className="text-runway font-heading tracking-widest uppercase text-sm">{nlMode ? 'AI is searching…' : 'Loading flights…'}</p>
          </div>
        )}
        {isError && (
          <div className="card border border-ember/30 p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-ember flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-heading font-semibold text-ember mb-1">Search Failed</p>
              <p className="text-sm text-runway">Unable to fetch flights. Please check your connection and try again.</p>
            </div>
          </div>
        )}

        {!isLoading && !isError && hasSearched && rawFlights.length > 0 && (
          <>
            {/* Sort + Filter bar */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {/* Sort pills */}
              {([
                { key: 'cheapest', icon: Wallet,       label: 'Cheapest' },
                { key: 'fastest',  icon: Gauge,        label: 'Fastest'  },
                { key: 'earliest', icon: Clock,        label: 'Earliest' },
                { key: 'latest',   icon: ArrowUpDown,  label: 'Latest'   },
              ] as const).map(({ key, icon: Icon, label }) => (
                <button key={key} type="button" onClick={() => setSort(key)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-heading tracking-wide border transition-all',
                    sort === key ? 'bg-gold/15 text-gold border-gold/30' : 'text-runway border-sky-light/20 hover:border-sky-light/40'
                  )}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}

              <button type="button" onClick={() => setShowFilters(f => !f)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-heading tracking-wide border transition-all ml-auto',
                  showFilters ? 'bg-gold/15 text-gold border-gold/30' : 'text-runway border-sky-light/20 hover:border-sky-light/40'
                )}>
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
                {(depSlot !== 'any' || arrSlot !== 'any' || (fareMax > 0 && fareMax < maxOutboundFare)) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-gold ml-1" />
                )}
              </button>
            </div>

            {/* Filter panel */}
            {showFilters && (
              <div className="card border border-sky-light/20 p-4 mb-4 animate-fade-up">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {/* Departure time */}
                  <div>
                    <p className="label mb-2">Departure Time</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => setDepSlot('any')}
                        className={cn('px-2.5 py-1 rounded-lg text-xs border transition-all',
                          depSlot === 'any' ? 'bg-gold/15 text-gold border-gold/30' : 'text-runway border-sky-light/20 hover:border-sky-light/40'
                        )}>Any</button>
                      {TIME_SLOTS.map(s => (
                        <button key={s.key} type="button" onClick={() => setDepSlot(s.key)}
                          className={cn('px-2.5 py-1 rounded-lg text-xs border transition-all',
                            depSlot === s.key ? 'bg-gold/15 text-gold border-gold/30' : 'text-runway border-sky-light/20 hover:border-sky-light/40'
                          )}>
                          {s.label} <span className="opacity-50">{s.range}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Arrival time */}
                  <div>
                    <p className="label mb-2">Arrival Time</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => setArrSlot('any')}
                        className={cn('px-2.5 py-1 rounded-lg text-xs border transition-all',
                          arrSlot === 'any' ? 'bg-gold/15 text-gold border-gold/30' : 'text-runway border-sky-light/20 hover:border-sky-light/40'
                        )}>Any</button>
                      {TIME_SLOTS.map(s => (
                        <button key={s.key} type="button" onClick={() => setArrSlot(s.key)}
                          className={cn('px-2.5 py-1 rounded-lg text-xs border transition-all',
                            arrSlot === s.key ? 'bg-gold/15 text-gold border-gold/30' : 'text-runway border-sky-light/20 hover:border-sky-light/40'
                          )}>
                          {s.label} <span className="opacity-50">{s.range}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Max fare */}
                  <div>
                    <p className="label mb-2">Max Fare <span className="text-gold font-mono">{formatCurrency(fareMax)}</span></p>
                    <input type="range" className="w-full accent-gold" min={0} max={maxOutboundFare || 10000} step={100}
                      value={fareMax || maxOutboundFare}
                      onChange={e => setFareMax(Number(e.target.value))} />
                    <div className="flex justify-between text-xs text-runway/50 mt-1">
                      <span>₹0</span>
                      <span>{formatCurrency(maxOutboundFare)}</span>
                    </div>
                  </div>
                </div>

                {(depSlot !== 'any' || arrSlot !== 'any' || fareMax < maxOutboundFare) && (
                  <button type="button" onClick={() => { setDepSlot('any'); setArrSlot('any'); setFareMax(maxOutboundFare); }}
                    className="mt-3 flex items-center gap-1 text-xs text-runway hover:text-ember transition-colors">
                    <X className="w-3 h-3" /> Clear filters
                  </button>
                )}
              </div>
            )}

            {/* ── ONE-WAY / NL RESULTS ── */}
            {(nlMode || tripType === 'one-way') && (
              <>
                <p className="text-sm text-runway font-heading tracking-wide mb-3">
                  {outboundFiltered.length} of {rawFlights.length} flight{rawFlights.length !== 1 ? 's' : ''} shown
                </p>
                {outboundFiltered.length === 0 ? (
                  <div className="card p-10 text-center">
                    <p className="font-heading text-cloud mb-1">No flights match your filters</p>
                    <button type="button" onClick={() => { setDepSlot('any'); setArrSlot('any'); setFareMax(maxOutboundFare); }} className="text-sm text-gold underline mt-2">Clear filters</button>
                  </div>
                ) : (
                  <div className="space-y-4 stagger-reveal">
                    {outboundFiltered.map(f => <FlightCard key={f.id} flight={f} pax={pax} />)}
                  </div>
                )}
              </>
            )}

            {/* ── ROUND-TRIP RESULTS ── */}
            {!nlMode && tripType === 'round-trip' && (
              <div className="space-y-6">
                {/* Outbound */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="badge badge-blue text-xs">Outbound</span>
                    <span className="text-sm text-runway">{origin || '?'} → {destination || '?'} · {date}</span>
                    <span className="text-xs text-runway/50 ml-auto">{outboundFiltered.length} options</span>
                  </div>
                  {outboundFiltered.length === 0 ? (
                    <div className="card p-6 text-center"><p className="text-runway text-sm">No outbound flights match filters</p></div>
                  ) : (
                    <div className="space-y-2">
                      {outboundFiltered.map(f => (
                        <FlightRow key={f.id} flight={f} pax={pax}
                          selected={selectedOutbound?.id === f.id}
                          onSelect={() => setSelectedOutbound(s => s?.id === f.id ? null : f)} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Return */}
                {returnDate && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="badge badge-gold text-xs">Return</span>
                      <span className="text-sm text-runway">{destination || '?'} → {origin || '?'} · {returnDate}</span>

                      {/* Return filter: departure slot */}
                      <div className="flex gap-1 ml-auto">
                        {(['any', ...TIME_SLOTS.map(s => s.key)] as TimeSlot[]).map(key => (
                          <button key={key} type="button" onClick={() => setRetDepSlot(key)}
                            className={cn('px-2 py-0.5 rounded text-xs border transition-all',
                              retDepSlot === key ? 'bg-gold/15 text-gold border-gold/30' : 'text-runway/60 border-sky-light/15 hover:border-sky-light/30'
                            )}>
                            {key === 'any' ? 'Any' : TIME_SLOTS.find(s => s.key === key)!.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {returnQuery.isLoading ? (
                      <div className="flex items-center justify-center gap-3 py-8">
                        <Loader2 className="w-5 h-5 text-gold animate-spin" />
                        <span className="text-runway text-sm">Loading return flights…</span>
                      </div>
                    ) : returnFiltered.length === 0 ? (
                      <div className="card p-6 text-center"><p className="text-runway text-sm">No return flights found</p></div>
                    ) : (
                      <div className="space-y-2">
                        {returnFiltered.map(f => (
                          <FlightRow key={f.id} flight={f} pax={pax}
                            selected={selectedReturn?.id === f.id}
                            onSelect={() => setSelectedReturn(s => s?.id === f.id ? null : f)} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Combined total + CTA */}
                {(selectedOutbound || selectedReturn) && (
                  <div className="card border border-gold/30 p-4 animate-fade-up">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1 text-sm">
                        {selectedOutbound && (
                          <div className="flex items-center gap-2">
                            <span className="badge badge-blue text-xs">Out</span>
                            <span className="font-mono text-cloud">{formatTime(selectedOutbound.departAt)}</span>
                            <ArrowRight className="w-3 h-3 text-runway/50" />
                            <span className="font-mono text-cloud">{formatTime(selectedOutbound.arriveAt)}</span>
                            <span className="text-runway/60 font-mono text-xs">{selectedOutbound.flightNo}</span>
                          </div>
                        )}
                        {selectedReturn && (
                          <div className="flex items-center gap-2">
                            <span className="badge badge-gold text-xs">Ret</span>
                            <span className="font-mono text-cloud">{formatTime(selectedReturn.departAt)}</span>
                            <ArrowRight className="w-3 h-3 text-runway/50" />
                            <span className="font-mono text-cloud">{formatTime(selectedReturn.arriveAt)}</span>
                            <span className="text-runway/60 font-mono text-xs">{selectedReturn.flightNo}</span>
                          </div>
                        )}
                        <p className="text-xs text-runway/60">{pax} pax · {selectedOutbound && selectedReturn ? 'Round trip total' : 'Partial selection'}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-heading text-2xl font-bold text-gold">{formatCurrency(totalRoundTripFare * pax)}</p>
                          {pax > 1 && <p className="text-xs text-runway/50">{formatCurrency(totalRoundTripFare)}/pax</p>}
                        </div>
                        {selectedOutbound && (
                          <button onClick={bookRoundTrip} className="btn-primary">
                            Book {selectedReturn ? 'Round Trip' : 'Outbound'} <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!isLoading && !isError && hasSearched && rawFlights.length === 0 && (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4 opacity-30">✈</div>
            <p className="font-heading text-xl font-semibold text-cloud mb-2">No Flights Found</p>
            <p className="text-sm text-runway max-w-sm mx-auto">Try adjusting your search criteria or check different dates.</p>
          </div>
        )}

        {!hasSearched && !isLoading && (
          <div className="card p-16 text-center border-dashed border-sky-light/20">
            <SearchIcon className="w-10 h-10 text-runway/40 mx-auto mb-4" />
            <p className="font-heading text-lg text-runway/60 tracking-wide">Enter search criteria to find flights</p>
          </div>
        )}
      </div>
    </div>
  );
}
