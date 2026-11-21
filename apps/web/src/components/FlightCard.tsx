import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plane, Clock, Users, ChevronRight, Wifi, Utensils } from 'lucide-react';
import type { Flight } from '../types';
import { formatCurrency, formatTime, formatDate, getDuration } from '../lib/utils';
import FareBadge from './FareBadge';

interface FlightCardProps {
  flight: Flight;
  pax?: number;
}

export default function FlightCard({ flight, pax = 1 }: FlightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const duration = getDuration(flight.departAt, flight.arriveAt);
  const occupancy = flight.capacity > 0 ? flight.seatsBooked / flight.capacity : 0;

  const statusColor = {
    SCHEDULED: 'badge-green',
    DEPARTED: 'badge-blue',
    ARRIVED: 'badge-gray',
    CANCELLED: 'badge-red',
  }[flight.status] ?? 'badge-gray';

  const totalFare = flight.baseFare * pax;

  return (
    <div className="flight-card group" onClick={() => setExpanded(!expanded)}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Flight Route */}
        <div className="flex-1 flex items-center gap-4">
          {/* Origin */}
          <div className="text-right sm:text-left">
            <p className="text-3xl font-heading font-bold text-cloud tracking-tight">
              {formatTime(flight.departAt)}
            </p>
            <p className="text-xl font-heading font-semibold text-gold">
              {flight.origin.code}
            </p>
            <p className="text-xs text-runway">{flight.origin.city}</p>
          </div>

          {/* Route line */}
          <div className="flex-1 flex flex-col items-center gap-1 min-w-20">
            <span className="text-xs text-runway font-mono">{duration}</span>
            <div className="relative w-full flex items-center">
              <div className="flex-1 h-px bg-gradient-to-r from-sky-light/50 via-gold/30 to-sky-light/50" />
              <Plane className="w-4 h-4 text-gold mx-1 flex-shrink-0" />
              <div className="flex-1 h-px bg-gradient-to-r from-sky-light/50 via-gold/30 to-sky-light/50" />
            </div>
            <span className="text-xs text-runway/60 font-mono uppercase">
              {flight.flightNo}
            </span>
          </div>

          {/* Destination */}
          <div>
            <p className="text-3xl font-heading font-bold text-cloud tracking-tight">
              {formatTime(flight.arriveAt)}
            </p>
            <p className="text-xl font-heading font-semibold text-gold">
              {flight.destination.code}
            </p>
            <p className="text-xs text-runway">{flight.destination.city}</p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3">
          <div className="text-right">
            <p className="text-xs text-runway font-heading tracking-wider uppercase">
              {pax > 1 ? `${pax} pax` : 'per seat'}
            </p>
            <p className="text-2xl font-heading font-bold text-cloud">
              {formatCurrency(totalFare)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <FareBadge flightId={flight.id} />
            <span className={`badge ${statusColor}`}>{flight.status}</span>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      <div
        className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-64 mt-4' : 'max-h-0'}`}
      >
        <div className="gold-line mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="label">Date</p>
            <p className="text-sm text-cloud">{formatDate(flight.departAt)}</p>
          </div>
          <div>
            <p className="label">Aircraft</p>
            <p className="text-sm text-cloud">{flight.aircraft.model}</p>
          </div>
          <div>
            <p className="label">Availability</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="progress-bar flex-1">
                <div
                  className="progress-fill"
                  style={{ width: `${occupancy * 100}%` }}
                />
              </div>
              <span className="text-xs font-mono text-runway">
                {flight.seatsLeft}
              </span>
            </div>
          </div>
          <div>
            <p className="label">Amenities</p>
            <div className="flex items-center gap-2 mt-1">
              <Wifi className="w-3.5 h-3.5 text-horizon-bright" aria-label="Wi-Fi" />
              <Utensils className="w-3.5 h-3.5 text-gold" aria-label="Meals" />
              <Users className="w-3.5 h-3.5 text-runway" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Link
            to={`/book/${flight.id}`}
            className="btn-primary btn-sm"
            onClick={e => e.stopPropagation()}
          >
            Select Flight
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Hover indicator */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="w-3.5 h-3.5 text-runway/60" />
          <span className="text-xs text-runway/60">
            {formatDate(flight.departAt, { weekday: 'short', day: '2-digit', month: 'short' })}
          </span>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-runway/40 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
      </div>
    </div>
  );
}
