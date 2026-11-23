import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Ticket,
  X,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle,
  Calendar,
  Plane,
  MapPin,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import ETicket from '../components/ETicket';
import FlightMap from '../components/FlightMap';
import RebookingSuggestions from '../components/RebookingSuggestions';
import { useToast } from '../components/Toast';
import { AIRPORT_COORDS } from '../lib/airports';
import type { Booking, Ticket as TicketType } from '../types';
import { formatCurrency, formatDate, formatTime, cn } from '../lib/utils';

function ConfirmCancelModal({
  open,
  booking,
  onConfirm,
  onClose,
  loading,
}: {
  open: boolean;
  booking: Booking;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-sky-darkest/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card border border-ember/30 p-6 max-w-md w-full animate-fade-up">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-ember" />
          <h2 className="font-heading text-xl font-semibold text-cloud">
            Cancel Booking
          </h2>
        </div>
        <p className="text-sm text-runway mb-2">
          Are you sure you want to cancel booking{' '}
          <span className="font-mono text-gold">{booking.pnr}</span>?
        </p>
        <p className="text-xs text-runway/60 mb-5">
          This action cannot be undone. Refund will be processed per our policy.
        </p>
        <div className="flex gap-3 justify-end">
          <button className="btn-ghost" onClick={onClose} disabled={loading}>
            Keep Booking
          </button>
          <button
            className="btn-danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cancelling…
              </>
            ) : (
              <>
                <X className="w-4 h-4" />
                Cancel Booking
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyBookings() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [viewTicketBookingId, setViewTicketBookingId] = useState<string | null>(null);
  const [trackBookingId, setTrackBookingId] = useState<string | null>(null);
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
  const [recentlyCancelled, setRecentlyCancelled] = useState<string | null>(null);

  const { data: bookings, isLoading, isError } = useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: () => api.get<Booking[]>('/bookings/mine'),
    select: (data) => [
      ...data.filter(b => b.status === 'CONFIRMED'),
      ...data.filter(b => b.status === 'CANCELLED'),
    ],
  });

  const { data: ticketData, isError: ticketError } = useQuery<{ ticket: TicketType; pdfUrl?: string }>({
    queryKey: ['ticket', viewTicketBookingId],
    queryFn: () =>
      api.get<{ ticket: TicketType; pdfUrl?: string }>(
        `/bookings/${viewTicketBookingId}/ticket`,
      ),
    enabled: !!viewTicketBookingId,
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) =>
      api.post(`/bookings/${bookingId}/cancel`),
    onSuccess: () => {
      const id = cancelBooking?.id;
      const flightId = cancelBooking?.flightId;
      setCancelBooking(null);
      toast.success('Booking Cancelled', 'Your booking has been cancelled.');
      void queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      if (id) setRecentlyCancelled(id);
      if (flightId) setRecentlyCancelled(flightId);
    },
    onError: err => {
      if (err instanceof ApiError) {
        toast.error('Cancellation Failed', err.message);
      }
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen hero-bg flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen art-deco-bg pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <p className="text-xs font-heading tracking-widest uppercase text-gold mb-1">
            My Account
          </p>
          <h1 className="section-title">My Bookings</h1>
          <div className="gold-line-left w-24 mt-2" />
        </div>

        {isError && (
          <div className="card border border-ember/30 p-5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-ember flex-shrink-0" />
            <p className="text-sm text-runway">Failed to load bookings. Please try again.</p>
          </div>
        )}

        {!isLoading && !isError && (!bookings || bookings.length === 0) && (
          <div className="card p-16 text-center border-dashed border-sky-light/20">
            <Ticket className="w-12 h-12 text-runway/30 mx-auto mb-4" />
            <p className="font-heading text-xl text-cloud mb-2">No Bookings Yet</p>
            <p className="text-sm text-runway mb-6">
              You haven't made any reservations. Ready to fly?
            </p>
            <Link to="/search" className="btn-primary">
              Search Flights
            </Link>
          </div>
        )}

        {bookings && bookings.length > 0 && (
          <div className="space-y-4 stagger-reveal">
            {bookings.map(booking => (
              <div
                key={booking.id}
                className={cn(
                  'card border p-5 transition-all',
                  booking.status === 'CANCELLED'
                    ? 'border-sky-light/20 opacity-70'
                    : 'border-sky-light/30 hover:border-gold/20',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Route info */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          'badge',
                          booking.status === 'CONFIRMED'
                            ? 'badge-green'
                            : 'badge-red',
                        )}
                      >
                        {booking.status === 'CONFIRMED' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                        {booking.status}
                      </span>
                      <span className="font-mono text-gold text-sm font-bold">
                        {booking.pnr}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div>
                        <p className="font-heading text-2xl font-bold text-cloud">
                          {booking.flight?.origin?.code ?? '---'}
                        </p>
                        <p className="text-xs text-runway">
                          {formatTime(booking.flight?.departAt ?? '')}
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1">
                          <div className="w-6 h-px bg-sky-light/40" />
                          <Plane className="w-3 h-3 text-gold" />
                          <div className="w-6 h-px bg-sky-light/40" />
                        </div>
                        <span className="text-xs text-runway/60 font-mono">
                          {booking.flight?.flightNo ?? ''}
                        </span>
                      </div>
                      <div>
                        <p className="font-heading text-2xl font-bold text-cloud">
                          {booking.flight?.destination?.code ?? '---'}
                        </p>
                        <p className="text-xs text-runway">
                          {formatTime(booking.flight?.arriveAt ?? '')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2 text-xs text-runway">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {formatDate(booking.flight?.departAt ?? booking.createdAt)}
                      </span>
                    </div>
                    <p className="font-heading font-bold text-cloud text-lg">
                      {formatCurrency(booking.farePaid)}
                    </p>
                    <p className="text-xs text-runway">
                      Seat{' '}
                      <span className="text-gold font-mono">
                        {booking.seat?.seatNo ?? '—'}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                {booking.status === 'CONFIRMED' && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-sky-light/20">
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() =>
                        setViewTicketBookingId(
                          viewTicketBookingId === booking.id ? null : booking.id,
                        )
                      }
                    >
                      <Eye className="w-4 h-4" />
                      {viewTicketBookingId === booking.id ? 'Hide' : 'View'} Ticket
                    </button>
                    {booking.flight?.flightNo &&
                      AIRPORT_COORDS[booking.flight.origin?.code] &&
                      AIRPORT_COORDS[booking.flight.destination?.code] && (
                      <button
                        type="button"
                        className={cn(
                          'btn-sm',
                          trackBookingId === booking.id ? 'btn-primary' : 'btn-secondary',
                        )}
                        onClick={() =>
                          setTrackBookingId(
                            trackBookingId === booking.id ? null : booking.id,
                          )
                        }
                      >
                        <MapPin className="w-4 h-4" />
                        {trackBookingId === booking.id ? 'Hide Map' : 'Track Flight'}
                      </button>
                    )}
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => setCancelBooking(booking)}
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                )}

                {/* Ticket view */}
                {viewTicketBookingId === booking.id && (
                  <div className="mt-4 pt-4 border-t border-sky-light/20">
                    {ticketError ? (
                      <div className="flex items-center gap-2 text-sm text-ember">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        Failed to load ticket. Please try again.
                      </div>
                    ) : ticketData ? (
                      <ETicket ticket={{ ...ticketData.ticket, pdfUrl: ticketData.pdfUrl }} />
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-runway">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading ticket…
                      </div>
                    )}
                  </div>
                )}

                {/* Inline flight map */}
                {trackBookingId === booking.id && booking.flight && (
                  <div className="mt-4 pt-4 border-t border-sky-light/20 animate-fade-up">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-heading tracking-widest uppercase text-runway">
                        Flight Path
                      </p>
                      <span className="text-xs text-runway/50 font-mono">
                        {booking.flight.origin.code} → {booking.flight.destination.code}
                      </span>
                    </div>
                    <FlightMap
                      originCode={booking.flight.origin.code}
                      destCode={booking.flight.destination.code}
                      departAt={booking.flight.departAt}
                      arriveAt={booking.flight.arriveAt}
                      height={320}
                    />
                  </div>
                )}

                {/* Rebooking suggestions after cancel */}
                {recentlyCancelled === booking.id &&
                  booking.status === 'CANCELLED' && (
                    <div className="mt-4 pt-4 border-t border-sky-light/20">
                      <RebookingSuggestions
                        flightId={booking.flightId}
                        onClose={() => setRecentlyCancelled(null)}
                      />
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel modal */}
      {cancelBooking && (
        <ConfirmCancelModal
          open={!!cancelBooking}
          booking={cancelBooking}
          onConfirm={() => cancelMutation.mutate(cancelBooking.id)}
          onClose={() => setCancelBooking(null)}
          loading={cancelMutation.isPending}
        />
      )}
    </div>
  );
}
