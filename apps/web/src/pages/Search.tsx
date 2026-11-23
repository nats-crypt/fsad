import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Search as SearchIcon,
  Zap,
  MapPin,
  Calendar,
  Users,
  Filter,
  Loader2,
  Sparkles,
  AlertCircle,
  Globe,
} from 'lucide-react';
import { api } from '../lib/api';
import FlightCard from '../components/FlightCard';
import LiveFlights from '../components/LiveFlights';
import type { Flight, ParsedSearch } from '../types';
import { cn } from '../lib/utils';

const AIRPORTS = [
  { code: 'DEL', city: 'Delhi' },
  { code: 'BOM', city: 'Mumbai' },
  { code: 'BLR', city: 'Bangalore' },
  { code: 'HYD', city: 'Hyderabad' },
  { code: 'MAA', city: 'Chennai' },
  { code: 'CCU', city: 'Kolkata' },
];

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const [nlMode, setNlMode] = useState(!!sp.get('q'));
  const [nlQuery, setNlQuery] = useState(sp.get('q') ?? '');
  const [liveMode, setLiveMode] = useState(false);

  // Classic form state
  const [origin, setOrigin] = useState(sp.get('origin') ?? '');
  const [destination, setDestination] = useState(sp.get('destination') ?? '');
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(() => {
    const d = sp.get('date') ?? today;
    return d < today ? today : d;
  });
  const [pax, setPax] = useState(Number(sp.get('pax') ?? 1));

  // NL parsed result
  const [parsedSearch, setParsedSearch] = useState<ParsedSearch | null>(null);

  // Classic flight query
  const flightQuery = useQuery<Flight[]>({
    queryKey: ['flights', origin, destination, date, pax],
    queryFn: () => {
      const params = new URLSearchParams();
      if (origin) params.set('origin', origin);
      if (destination) params.set('destination', destination);
      if (date) params.set('date', date);
      params.set('pax', String(pax));
      return api.get<Flight[]>(`/flights?${params.toString()}`);
    },
    enabled: !nlMode && !liveMode,
    staleTime: 0,
  });

  // NL search mutation
  const nlMutation = useMutation({
    mutationFn: (text: string) =>
      api.post<{ parsed: ParsedSearch; flights: Flight[] }>('/ai/search', {
        text,
      }),
    onSuccess: data => {
      setParsedSearch(data.parsed);
    },
  });

  // On initial load with classic params
  useEffect(() => {
    if (!nlMode && (origin || destination)) {
      void flightQuery.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-search on NL if query in URL
  useEffect(() => {
    const q = sp.get('q');
    if (q && nlMode) {
      nlMutation.mutate(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClassicSearch(e: FormEvent) {
    e.preventDefault();
    setSp({ origin, destination, date, pax: String(pax) });
    void flightQuery.refetch();
  }

  function handleNlSearch(e: FormEvent) {
    e.preventDefault();
    if (nlQuery.trim()) {
      setSp({ q: nlQuery });
      nlMutation.mutate(nlQuery);
    }
  }

  const flights = nlMode ? nlMutation.data?.flights ?? [] : flightQuery.data ?? [];
  const isLoading = nlMode ? nlMutation.isPending : flightQuery.isLoading;
  const isError = nlMode ? nlMutation.isError : flightQuery.isError;
  const hasSearched = nlMode ? nlMutation.isSuccess || nlMutation.isPending : !flightQuery.isLoading;

  return (
    <div className="min-h-screen art-deco-bg pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <p className="text-xs font-heading tracking-widest uppercase text-gold mb-1">
            Flight Search
          </p>
          <h1 className="section-title">Find Your Flight</h1>
          <div className="gold-line-left w-24 mt-2" />
        </div>

        {/* Search widget */}
        <div className="card border border-sky-light/30 p-5 mb-8 animate-fade-up animate-delay-100">
          {/* Mode toggle */}
          <div className="flex items-center gap-2 mb-5">
            <button
              onClick={() => { setNlMode(false); setLiveMode(false); }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading tracking-wider uppercase transition-all',
                !nlMode && !liveMode
                  ? 'bg-gold/15 text-gold border border-gold/30'
                  : 'text-runway hover:text-cloud',
              )}
            >
              <Filter className="w-3.5 h-3.5" aria-hidden="true" />
              Classic
            </button>
            <button
              onClick={() => { setNlMode(true); setLiveMode(false); }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading tracking-wider uppercase transition-all',
                nlMode && !liveMode
                  ? 'bg-gold/15 text-gold border border-gold/30'
                  : 'text-runway hover:text-cloud',
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Search
            </button>
            <button
              onClick={() => { setLiveMode(true); setNlMode(false); }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading tracking-wider uppercase transition-all',
                liveMode
                  ? 'bg-gold/15 text-gold border border-gold/30'
                  : 'text-runway hover:text-cloud',
              )}
            >
              <Globe className="w-3.5 h-3.5" />
              Live Fares
            </button>
          </div>

          {liveMode ? (
            <LiveFlights />
          ) : nlMode ? (
            <form onSubmit={handleNlSearch} className="flex gap-3">
              <div className="flex-1 input-group">
                <Zap className="input-icon w-4 h-4 text-gold" />
                <input
                  className="input pl-11"
                  placeholder='e.g. "Morning flight from Delhi to Mumbai this Friday"'
                  value={nlQuery}
                  onChange={e => setNlQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="btn-primary flex-shrink-0"
                disabled={nlMutation.isPending}
              >
                {nlMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <SearchIcon className="w-4 h-4" />
                )}
                Search
              </button>
            </form>
          ) : (
            <form onSubmit={handleClassicSearch}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="label">From</label>
                  <div className="input-group">
                    <MapPin className="input-icon w-4 h-4" />
                    <select
                      className="input pl-11"
                      value={origin}
                      onChange={e => setOrigin(e.target.value)}
                    >
                      <option value="">Any origin</option>
                      {AIRPORTS.map(a => (
                        <option key={a.code} value={a.code}>
                          {a.code} — {a.city}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">To</label>
                  <div className="input-group">
                    <MapPin className="input-icon w-4 h-4" />
                    <select
                      className="input pl-11"
                      value={destination}
                      onChange={e => setDestination(e.target.value)}
                    >
                      <option value="">Any destination</option>
                      {AIRPORTS.map(a => (
                        <option key={a.code} value={a.code}>
                          {a.code} — {a.city}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Date</label>
                  <div className="input-group">
                    <Calendar className="input-icon w-4 h-4" />
                    <input
                      type="date"
                      className="input pl-11"
                      value={date}
                      min={today}
                      onChange={e => {
                        const v = e.target.value;
                        setDate(v < today ? today : v);
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Passengers</label>
                  <div className="input-group">
                    <Users className="input-icon w-4 h-4" />
                    <input
                      type="number"
                      className="input pl-11"
                      min={1}
                      max={9}
                      value={pax}
                      onChange={e => setPax(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
              <button type="submit" className="btn-primary mt-3">
                <SearchIcon className="w-4 h-4" />
                Search Flights
              </button>
            </form>
          )}

          {/* NL parsed indicator */}
          {nlMode && parsedSearch && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-runway font-heading tracking-wide">
                AI parsed:
              </span>
              {parsedSearch.origin && (
                <span className="badge badge-blue">From: {parsedSearch.origin}</span>
              )}
              {parsedSearch.destination && (
                <span className="badge badge-blue">To: {parsedSearch.destination}</span>
              )}
              {parsedSearch.dateFrom && (
                <span className="badge badge-gray">Date: {parsedSearch.dateFrom}</span>
              )}
              {parsedSearch.timeOfDay && (
                <span className="badge badge-gray">{parsedSearch.timeOfDay}</span>
              )}
              {parsedSearch.sort && (
                <span className="badge badge-gold">{parsedSearch.sort}</span>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        {!liveMode && (
          <>
        {isLoading && (
          <div className="flex flex-col items-center gap-4 py-16 animate-fade-in">
            <Loader2 className="w-10 h-10 text-gold animate-spin" />
            <p className="text-runway font-heading tracking-widest uppercase text-sm">
              {nlMode ? 'AI is searching…' : 'Loading flights…'}
            </p>
          </div>
        )}

        {isError && (
          <div className="card border border-ember/30 p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-ember flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-heading font-semibold text-ember mb-1">
                Search Failed
              </p>
              <p className="text-sm text-runway">
                Unable to fetch flights. Please check your connection and try
                again.
              </p>
            </div>
          </div>
        )}

        {!isLoading && !isError && hasSearched && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-runway font-heading tracking-wide">
                {flights.length > 0
                  ? `${flights.length} flight${flights.length !== 1 ? 's' : ''} found`
                  : 'No flights found'}
              </p>
            </div>

            {flights.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="text-5xl mb-4 opacity-30">✈</div>
                <p className="font-heading text-xl font-semibold text-cloud mb-2">
                  No Flights Found
                </p>
                <p className="text-sm text-runway max-w-sm mx-auto">
                  Try adjusting your search criteria or check different dates.
                </p>
              </div>
            ) : (
              <div className="space-y-4 stagger-reveal">
                {flights.map(flight => (
                  <FlightCard key={flight.id} flight={flight} pax={pax} />
                ))}
              </div>
            )}
          </>
        )}

        {!hasSearched && !isLoading && (
          <div className="card p-16 text-center border-dashed border-sky-light/20">
            <SearchIcon className="w-10 h-10 text-runway/40 mx-auto mb-4" />
            <p className="font-heading text-lg text-runway/60 tracking-wide">
              Enter search criteria to find flights
            </p>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
