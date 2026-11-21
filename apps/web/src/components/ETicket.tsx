import { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, Download, Plane, QrCode } from 'lucide-react';
import type { Ticket } from '../types';
import { formatDate, formatTime, formatCurrency } from '../lib/utils';

interface ETicketProps {
  ticket: Ticket;
}

export default function ETicket({ ticket }: ETicketProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [qrLoaded, setQrLoaded] = useState(false);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Horizon-Airways-${ticket.pnr}`,
  });

  const handleDownload = async () => {
    if (ticket.pdfUrl) {
      window.open(ticket.pdfUrl, '_blank');
      return;
    }
    handlePrint();
  };

  const f = ticket.flight;
  const p = ticket.passenger;

  return (
    <div>
      {/* Action buttons */}
      <div className="flex gap-3 mb-4 no-print">
        <button onClick={() => handlePrint()} className="btn-secondary btn-sm">
          <Printer className="w-4 h-4" />
          Print
        </button>
        <button onClick={handleDownload} className="btn-primary btn-sm">
          <Download className="w-4 h-4" />
          Download PDF
        </button>
      </div>

      {/* Ticket */}
      <div
        ref={printRef}
        className="e-ticket bg-sky-dark border border-sky-light/30 rounded-2xl overflow-hidden"
        style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
      >
        {/* Header stripe */}
        <div className="bg-gradient-to-r from-sky-darkest via-sky-mid to-sky-darkest p-5 flex items-center justify-between border-b border-gold/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold/15 border border-gold/40 flex items-center justify-center">
              <Plane className="w-5 h-5 text-gold -rotate-45" />
            </div>
            <div>
              <p className="font-heading text-xl font-bold tracking-widest uppercase text-cloud">
                HORIZON AIRWAYS
              </p>
              <p className="text-xs text-runway font-mono">BOARDING PASS</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-runway uppercase tracking-widest font-heading">
              PNR
            </p>
            <p className="font-mono text-2xl font-bold text-gold tracking-widest">
              {ticket.pnr}
            </p>
          </div>
        </div>

        {/* Route */}
        <div className="p-5 grid grid-cols-3 gap-4 items-center border-b border-sky-light/20">
          <div>
            <p className="text-5xl font-heading font-bold text-cloud">
              {f.origin.code}
            </p>
            <p className="text-sm text-runway">{f.origin.city}</p>
            <p className="text-xl font-heading font-semibold text-gold mt-1">
              {formatTime(f.departAt)}
            </p>
            <p className="text-xs text-runway/70">{formatDate(f.departAt)}</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
            <Plane className="w-6 h-6 text-gold" />
            <p className="text-xs text-runway font-mono uppercase tracking-wider">
              {f.flightNo}
            </p>
            <div className="w-full h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          </div>

          <div className="text-right">
            <p className="text-5xl font-heading font-bold text-cloud">
              {f.destination.code}
            </p>
            <p className="text-sm text-runway">{f.destination.city}</p>
            <p className="text-xl font-heading font-semibold text-gold mt-1">
              {formatTime(f.arriveAt)}
            </p>
            <p className="text-xs text-runway/70">{formatDate(f.arriveAt)}</p>
          </div>
        </div>

        {/* Passenger & Seat details */}
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-5 border-b border-sky-light/20">
          <div>
            <p className="label">Passenger</p>
            <p className="text-sm font-semibold text-cloud">{p.fullName}</p>
            {p.phone && <p className="text-xs text-runway">{p.phone}</p>}
          </div>
          <div>
            <p className="label">Seat</p>
            <p className="text-2xl font-heading font-bold text-gold">
              {ticket.seat.seatNo}
            </p>
            <p className="text-xs text-runway">{ticket.seat.cabinClass}</p>
          </div>
          <div>
            <p className="label">Class</p>
            <p className="text-sm text-cloud font-semibold">
              {ticket.seat.cabinClass}
            </p>
            {p.preferences?.meal && (
              <p className="text-xs text-runway">{p.preferences.meal} meal</p>
            )}
          </div>
          <div>
            <p className="label">Fare Paid</p>
            <p className="text-sm font-heading font-bold text-cloud">
              {formatCurrency(ticket.farePaid)}
            </p>
            <p className="text-xs text-runway">
              Issued: {formatDate(ticket.issuedAt)}
            </p>
          </div>
        </div>

        {/* Tear line + QR */}
        <div className="flex items-center gap-0 overflow-hidden">
          <div className="flex-1 border-t-2 border-dashed border-sky-light/30" />
          <div className="w-6 h-6 rounded-full border-2 border-sky-light/30 bg-sky-darkest flex-shrink-0" />
        </div>

        <div className="p-5 flex items-center justify-between gap-4">
          <div className="grid grid-cols-2 gap-4 text-xs text-runway">
            <div>
              <span className="font-heading tracking-widest uppercase">Aircraft</span>
              <p className="text-cloud">{f.aircraft.model}</p>
            </div>
            <div>
              <span className="font-heading tracking-widest uppercase">Status</span>
              <p className="text-gold">{f.status}</p>
            </div>
            {p.preferences?.assistance && (
              <div className="col-span-2">
                <span className="font-heading tracking-widest uppercase">
                  Special Assistance
                </span>
                <p className="text-cloud">{p.preferences.assistance}</p>
              </div>
            )}
          </div>

          {/* QR Code placeholder */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center overflow-hidden">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=HORIZON-${ticket.pnr}&bgcolor=ffffff&color=0a1628`}
                alt={`QR for PNR ${ticket.pnr}`}
                className="w-full h-full"
                onLoad={() => setQrLoaded(true)}
                onError={() => setQrLoaded(false)}
              />
              {!qrLoaded && <QrCode className="w-10 h-10 text-sky-dark" />}
            </div>
            <p className="text-xs text-runway font-mono">{ticket.pnr}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-sky-darkest px-5 py-3 flex items-center justify-between border-t border-sky-light/20">
          <p className="text-xs text-runway/60 font-mono">
            horizonairways.in · IATA · BCAS
          </p>
          <p className="text-xs text-runway/60 font-mono">
            Please arrive 2 hours before departure
          </p>
        </div>
      </div>
    </div>
  );
}
