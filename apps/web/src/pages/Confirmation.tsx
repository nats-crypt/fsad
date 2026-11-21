import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Loader2, AlertCircle, Ticket, List } from 'lucide-react';
import { api } from '../lib/api';
import ETicket from '../components/ETicket';
import type { Ticket as TicketType } from '../types';

export default function Confirmation() {
  const { bookingId } = useParams<{ bookingId: string }>();

  const { data, isLoading, isError } = useQuery<{ ticket: TicketType; pdfUrl?: string }>({
    queryKey: ['ticket', bookingId],
    queryFn: () => api.get<{ ticket: TicketType; pdfUrl?: string }>(`/bookings/${bookingId}/ticket`),
    enabled: !!bookingId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen hero-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-gold animate-spin" />
          <p className="text-runway font-heading tracking-widest uppercase">
            Generating your ticket…
          </p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen hero-bg flex items-center justify-center">
        <div className="card p-8 text-center max-w-md">
          <AlertCircle className="w-10 h-10 text-ember mx-auto mb-4" />
          <p className="font-heading text-xl text-cloud mb-2">Ticket Not Found</p>
          <p className="text-runway mb-4">
            Your booking was confirmed but we couldn't load your ticket.
          </p>
          <Link to="/my-bookings" className="btn-primary">
            View My Bookings
          </Link>
        </div>
      </div>
    );
  }

  const ticket = { ...data.ticket, pdfUrl: data.pdfUrl };

  return (
    <div className="min-h-screen art-deco-bg pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Success banner */}
        <div className="flex flex-col items-center text-center mb-8 animate-fade-up">
          <div className="relative mb-4">
            <div className="w-20 h-20 rounded-full bg-jade/10 border-2 border-jade/40 flex items-center justify-center shadow-lg">
              <CheckCircle className="w-10 h-10 text-jade" />
            </div>
            <div className="absolute -inset-2 rounded-full border border-jade/20 animate-pulse" />
          </div>
          <h1 className="font-heading text-4xl font-bold uppercase tracking-widest text-cloud mb-2">
            Booking Confirmed!
          </h1>
          <p className="font-display text-xl italic text-runway mb-1">
            Your journey begins here.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/40" />
            <span className="font-mono text-gold text-lg tracking-widest font-bold">
              PNR: {ticket.pnr}
            </span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/40" />
          </div>
        </div>

        {/* E-Ticket */}
        <div className="animate-fade-up animate-delay-200">
          <ETicket ticket={ticket} />
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap gap-4 justify-center mt-8 animate-fade-up animate-delay-300 no-print">
          <Link to="/my-bookings" className="btn-secondary flex items-center gap-2">
            <List className="w-4 h-4" />
            All Bookings
          </Link>
          <Link to="/search" className="btn-ghost flex items-center gap-2">
            <Ticket className="w-4 h-4" />
            Book Another
          </Link>
        </div>
      </div>
    </div>
  );
}
