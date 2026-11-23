import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Ticket,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Plane,
  Search,
  Calendar,
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatCurrency, formatDate, formatTime, cn } from '../../lib/utils';

interface AdminBooking {
  id: string;
  pnr: string;
  status: 'CONFIRMED' | 'CANCELLED';
  farePaid: number;
  createdAt: string;
  cancelledAt?: string;
  passenger: { fullName: string; userId: string };
  flight: {
    flightNo: string;
    departAt: string;
    arriveAt: string;
    origin: { code: string; city: string };
    destination: { code: string; city: string };
  };
  seat: { seatNo: string; cabinClass: string };
  payment: { amount: number; status: string; method: string } | null;
}

export default function BookingsAdmin() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'CONFIRMED' | 'CANCELLED'>('ALL');

  const { data: bookings, isLoading, isError } = useQuery<AdminBooking[]>({
    queryKey: ['admin-bookings'],
    queryFn: () => api.get<AdminBooking[]>('/bookings/all'),
    refetchInterval: 60_000,
  });

  const filtered = bookings?.filter(b => {
    if (filter !== 'ALL' && b.status !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.pnr.toLowerCase().includes(q) ||
      b.passenger.fullName.toLowerCase().includes(q) ||
      b.flight.flightNo.toLowerCase().includes(q) ||
      b.flight.origin.code.toLowerCase().includes(q) ||
      b.flight.destination.code.toLowerCase().includes(q)
    );
  });

  const confirmed = bookings?.filter(b => b.status === 'CONFIRMED').length ?? 0;
  const cancelled = bookings?.filter(b => b.status === 'CANCELLED').length ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-cloud">All Bookings</h1>
        <p className="text-sm text-runway mt-1">Bookings across all passengers and flights</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card border border-sky-light/20 p-4">
          <p className="text-xs text-runway uppercase tracking-wider">Total</p>
          <p className="font-heading text-2xl font-bold text-cloud mt-1">{bookings?.length ?? '—'}</p>
        </div>
        <div className="card border border-emerald-500/20 p-4">
          <p className="text-xs text-runway uppercase tracking-wider">Confirmed</p>
          <p className="font-heading text-2xl font-bold text-emerald-400 mt-1">{confirmed}</p>
        </div>
        <div className="card border border-ember/20 p-4">
          <p className="text-xs text-runway uppercase tracking-wider">Cancelled</p>
          <p className="font-heading text-2xl font-bold text-ember mt-1">{cancelled}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-runway/50" />
          <input
            type="text"
            className="input pl-9 w-full text-sm"
            placeholder="Search PNR, passenger, flight…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['ALL', 'CONFIRMED', 'CANCELLED'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'btn-sm font-heading tracking-wider text-xs',
                filter === f ? 'btn-primary' : 'btn-ghost',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-gold animate-spin" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="card border border-ember/30 p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-ember" />
          <p className="text-sm text-runway">Failed to load bookings.</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtered?.length === 0 && (
        <div className="card p-12 text-center border-dashed border-sky-light/20">
          <Ticket className="w-10 h-10 text-runway/30 mx-auto mb-3" />
          <p className="text-runway">No bookings match your filter.</p>
        </div>
      )}

      {/* Table */}
      {filtered && filtered.length > 0 && (
        <div className="card border border-sky-light/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sky-light/20 text-left">
                  <th className="px-4 py-3 text-xs font-heading tracking-widest uppercase text-runway">PNR</th>
                  <th className="px-4 py-3 text-xs font-heading tracking-widest uppercase text-runway">Passenger</th>
                  <th className="px-4 py-3 text-xs font-heading tracking-widest uppercase text-runway">Flight</th>
                  <th className="px-4 py-3 text-xs font-heading tracking-widest uppercase text-runway">Route</th>
                  <th className="px-4 py-3 text-xs font-heading tracking-widest uppercase text-runway">Date</th>
                  <th className="px-4 py-3 text-xs font-heading tracking-widest uppercase text-runway">Seat</th>
                  <th className="px-4 py-3 text-xs font-heading tracking-widest uppercase text-runway">Fare</th>
                  <th className="px-4 py-3 text-xs font-heading tracking-widest uppercase text-runway">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-light/10">
                {filtered.map(b => (
                  <tr key={b.id} className={cn(
                    'hover:bg-sky-light/5 transition-colors',
                    b.status === 'CANCELLED' && 'opacity-60',
                  )}>
                    <td className="px-4 py-3 font-mono text-gold font-bold">{b.pnr}</td>
                    <td className="px-4 py-3 text-cloud">{b.passenger.fullName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-runway">{b.flight.flightNo}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-heading font-bold text-cloud">{b.flight.origin.code}</span>
                        <Plane className="w-3 h-3 text-gold" />
                        <span className="font-heading font-bold text-cloud">{b.flight.destination.code}</span>
                      </div>
                      <p className="text-xs text-runway mt-0.5">
                        {formatTime(b.flight.departAt)} → {formatTime(b.flight.arriveAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-runway">
                        <Calendar className="w-3 h-3" />
                        {formatDate(b.flight.departAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-gold text-xs">{b.seat.seatNo}</td>
                    <td className="px-4 py-3 font-heading font-bold text-cloud">{formatCurrency(b.farePaid)}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'badge',
                        b.status === 'CONFIRMED' ? 'badge-green' : 'badge-red',
                      )}>
                        {b.status === 'CONFIRMED'
                          ? <CheckCircle className="w-3 h-3" />
                          : <X className="w-3 h-3" />}
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
