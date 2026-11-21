import { useQuery } from '@tanstack/react-query';
import { Plane, ArrowRight, TrendingUp, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Flight } from '../types';
import { formatCurrency, formatTime, formatDate, getDuration } from '../lib/utils';

interface RebookingSuggestionsProps {
  flightId: string;
  onClose?: () => void;
}

export default function RebookingSuggestions({
  flightId,
  onClose,
}: RebookingSuggestionsProps) {
  const { data, isLoading, isError } = useQuery<Flight[]>({
    queryKey: ['rebooking', flightId],
    queryFn: () =>
      api
        .post<{ flights: Flight[] }>('/ai/rebooking', { flightId })
        .then(r => r.flights),
    enabled: !!flightId,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="card p-6 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 text-gold animate-spin" />
        <span className="text-runway font-heading tracking-wide">
          Finding alternatives…
        </span>
      </div>
    );
  }

  if (isError || !data?.length) {
    return (
      <div className="card p-6 text-center">
        <p className="text-runway font-heading tracking-wide">
          No alternative flights found at this time.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-gold" />
        <h3 className="font-heading text-lg font-semibold tracking-wide text-cloud">
          Alternative Flights
        </h3>
        <span className="badge badge-gold ml-auto">AI Suggested</span>
      </div>

      <div className="space-y-3">
        {data.slice(0, 4).map(flight => (
          <div
            key={flight.id}
            className="flex items-center justify-between p-3 rounded-xl bg-sky-mid/40 border border-sky-light/20 hover:border-gold/20 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="font-heading font-bold text-cloud">
                  {formatTime(flight.departAt)}
                </p>
                <p className="text-xs text-gold font-heading">{flight.origin.code}</p>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs text-runway font-mono">
                  {getDuration(flight.departAt, flight.arriveAt)}
                </span>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-px bg-sky-light/50" />
                  <Plane className="w-3 h-3 text-gold" />
                  <div className="w-6 h-px bg-sky-light/50" />
                </div>
                <span className="text-xs text-runway/60 font-mono">
                  {flight.flightNo}
                </span>
              </div>
              <div className="text-center">
                <p className="font-heading font-bold text-cloud">
                  {formatTime(flight.arriveAt)}
                </p>
                <p className="text-xs text-gold font-heading">
                  {flight.destination.code}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="font-heading font-bold text-cloud">
                {formatCurrency(flight.baseFare)}
              </p>
              <Link
                to={`/book/${flight.id}`}
                className="btn-secondary btn-sm"
                onClick={onClose}
              >
                Select
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-runway/60 mt-3 text-center">
        {formatDate(data[0]?.departAt ?? '')} · AI-ranked by time proximity and fare
      </p>
    </div>
  );
}
