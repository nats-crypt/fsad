import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Globe, Plane, Loader2, Search as SearchIcon, Clock, ArrowRight, Info } from 'lucide-react';
import { api } from '../lib/api';

interface LiveFlight {
  airlines: string[];
  flightNumbers: string[];
  departAirport: string;
  arriveAirport: string;
  departTime: string;
  arriveTime: string;
  totalDurationMin: number;
  stops: number;
  price: number;
  currency: string;
  airlineLogo?: string;
}
interface LiveResult {
  available: boolean;
  flights: LiveFlight[];
  message?: string;
}

const fmtDur = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
const fmtTime = (t: string) => (t && t.includes(' ') ? t.split(' ')[1] : t);

export default function LiveFlights() {
  const [departureId, setDepartureId] = useState('CDG');
  const [arrivalId, setArrivalId] = useState('AUS');
  const [date, setDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0],
  );

  const live = useMutation({
    mutationFn: () => {
      const p = new URLSearchParams({
        departureId: departureId.trim().toUpperCase(),
        arrivalId: arrivalId.trim().toUpperCase(),
        outboundDate: date,
        currency: 'USD',
      });
      return api.get<LiveResult>(`/flights/live?${p.toString()}`);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (departureId.trim() && arrivalId.trim()) live.mutate();
  }

  const res = live.data;

  return (
    <div>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="label">From (IATA)</label>
          <div className="input-group">
            <Globe className="input-icon w-4 h-4" />
            <input
              className="input pl-11 uppercase"
              placeholder="CDG"
              maxLength={4}
              value={departureId}
              onChange={e => setDepartureId(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">To (IATA)</label>
          <div className="input-group">
            <Plane className="input-icon w-4 h-4" />
            <input
              className="input pl-11 uppercase"
              placeholder="AUS"
              maxLength={4}
              value={arrivalId}
              onChange={e => setArrivalId(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Date</label>
          <div className="input-group">
            <Clock className="input-icon w-4 h-4" />
            <input
              type="date"
              className="input pl-11"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setDate(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full" disabled={live.isPending}>
            {live.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchIcon className="w-4 h-4" />}
            Live Search
          </button>
        </div>
      </form>

      <p className="mt-3 flex items-center gap-2 text-xs text-runway">
        <span className="badge badge-gold">Live via Google Flights</span>
        Real-time market fares (informational — not bookable here).
      </p>

      <div className="mt-6">
        {live.isPending && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="w-9 h-9 text-gold animate-spin" />
            <p className="text-runway font-heading tracking-widest uppercase text-sm">
              Fetching live fares…
            </p>
          </div>
        )}

        {live.isError && (
          <div className="card border border-ember/30 p-5 text-sm text-runway">
            Couldn’t reach the live flight service. Please try again.
          </div>
        )}

        {res && !res.available && (
          <div className="card border border-sky-light/30 p-5 flex items-start gap-3">
            <Info className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-heading font-semibold text-cloud mb-1">Live fares not active</p>
              <p className="text-sm text-runway">
                {res.message ?? 'Set SERPAPI_KEY on the server to enable live Google Flights data.'}{' '}
                Use the Classic or AI search for bookable Horizon flights.
              </p>
            </div>
          </div>
        )}

        {res && res.available && (
          <>
            <p className="text-sm text-runway font-heading tracking-wide mb-4">
              {res.flights.length} live result{res.flights.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-4 stagger-reveal">
              {res.flights.map((f, i) => (
                <div key={i} className="card border border-sky-light/30 p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    {f.airlineLogo ? (
                      <img src={f.airlineLogo} alt="" className="w-10 h-10 rounded object-contain bg-white/90 p-1" />
                    ) : (
                      <Plane className="w-8 h-8 text-gold" />
                    )}
                    <div className="min-w-0">
                      <p className="font-heading text-cloud font-semibold truncate">
                        {f.airlines.join(', ') || 'Multiple carriers'}
                      </p>
                      <p className="text-xs text-runway truncate">{f.flightNumbers.join(' · ')}</p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 text-cloud">
                    <div className="text-right">
                      <p className="font-heading text-lg">{fmtTime(f.departTime)}</p>
                      <p className="text-xs text-runway">{f.departAirport}</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-runway">{fmtDur(f.totalDurationMin)}</span>
                      <ArrowRight className="w-4 h-4 text-gold" />
                      <span className="text-[10px] text-runway">
                        {f.stops === 0 ? 'Non-stop' : `${f.stops} stop${f.stops > 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <div>
                      <p className="font-heading text-lg">{fmtTime(f.arriveTime)}</p>
                      <p className="text-xs text-runway">{f.arriveAirport}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-heading text-xl text-gold">
                      {f.currency === 'USD' ? '$' : ''}{f.price.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-runway uppercase tracking-wider">{f.currency}</p>
                  </div>
                </div>
              ))}
              {res.flights.length === 0 && (
                <div className="card p-10 text-center text-runway">No live flights found for this route/date.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
