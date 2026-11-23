import { cn } from '../lib/utils';
import type { Seat } from '../types';

interface SeatMapProps {
  seats: Seat[];
  selectedSeat: string | null;
  /** For multi-passenger: list of all selected seat IDs */
  selectedSeats?: string[];
  /** For multi-passenger: max seats user can select */
  maxSelectable?: number;
  onSelect: (seatId: string, seatNo: string) => void;
  disabled?: boolean;
}

const CABIN_ORDER = { FIRST: 0, BUSINESS: 1, ECONOMY: 2 };
const CABIN_LABELS = {
  FIRST: 'First Class',
  BUSINESS: 'Business',
  ECONOMY: 'Economy',
};
const CABIN_COLORS = {
  FIRST: {
    available: 'seat-first',
    selected: 'seat-first-selected',
    booked: 'seat-booked',
  },
  BUSINESS: {
    available: 'seat-available bg-horizon/30 border-horizon/50 hover:bg-horizon/60',
    selected: 'seat-selected',
    booked: 'seat-booked',
  },
  ECONOMY: {
    available: 'seat-available',
    selected: 'seat-selected',
    booked: 'seat-booked',
  },
};

function groupSeats(seats: Seat[]): Map<string, Map<string, Seat[]>> {
  const cabins = new Map<string, Map<string, Seat[]>>();
  for (const seat of seats) {
    const cabin = seat.cabinClass || 'ECONOMY';
    const rowMatch = seat.seatNo.match(/^(\d+)/);
    const row = rowMatch ? rowMatch[1] : '1';
    if (!cabins.has(cabin)) cabins.set(cabin, new Map());
    const rows = cabins.get(cabin)!;
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row)!.push(seat);
  }
  return cabins;
}

function getSeatPosition(col: string): string {
  if (col === 'A' || col === 'F') return 'Window';
  if (col === 'B' || col === 'E') return 'Middle';
  return 'Aisle';
}

export default function SeatMap({ seats, selectedSeat, selectedSeats, maxSelectable, onSelect, disabled }: SeatMapProps) {
  const cabins = groupSeats(seats);
  const sortedCabins = [...cabins.entries()].sort(
    ([a], [b]) =>
      (CABIN_ORDER[a as keyof typeof CABIN_ORDER] ?? 99) -
      (CABIN_ORDER[b as keyof typeof CABIN_ORDER] ?? 99),
  );

  if (!seats.length) {
    return (
      <div className="text-center py-12 text-runway">
        <p className="font-heading text-lg">No seat data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-heading tracking-wider uppercase">
        <div className="flex items-center gap-2">
          <div className="seat w-7 h-7 seat-available pointer-events-none" />
          <span className="text-runway">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="seat w-7 h-7 seat-selected pointer-events-none" />
          <span className="text-runway">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="seat w-7 h-7 seat-booked pointer-events-none" />
          <span className="text-runway">Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="seat w-7 h-7 seat-first pointer-events-none" />
          <span className="text-runway">First Class</span>
        </div>
      </div>

      {/* Cockpit decoration */}
      <div className="flex flex-col items-center">
        <div className="w-28 h-10 rounded-t-full border border-sky-light/40 bg-sky-mid/30 flex items-center justify-center">
          <span className="text-xs text-runway font-mono uppercase tracking-widest">
            Cockpit
          </span>
        </div>
        <div className="w-px h-4 bg-sky-light/30" />
      </div>

      {sortedCabins.map(([cabin, rows]) => {
        const colors = CABIN_COLORS[cabin as keyof typeof CABIN_COLORS] ?? CABIN_COLORS.ECONOMY;
        const sortedRows = [...rows.entries()].sort(
          ([a], [b]) => parseInt(a) - parseInt(b),
        );

        return (
          <div key={cabin}>
            {/* Cabin label */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-sky-light/20" />
              <span
                className={cn(
                  'badge text-xs',
                  cabin === 'FIRST'
                    ? 'badge-gold'
                    : cabin === 'BUSINESS'
                      ? 'badge-blue'
                      : 'badge-gray',
                )}
              >
                {CABIN_LABELS[cabin as keyof typeof CABIN_LABELS] ?? cabin}
                {(() => {
                  const firstSeat = rows.values().next().value?.[0];
                  return firstSeat?.fare ? (
                    <span className="ml-1.5 opacity-80">
                      · ₹{firstSeat.fare.toLocaleString()}
                    </span>
                  ) : null;
                })()}
              </span>
              <div className="h-px flex-1 bg-sky-light/20" />
            </div>

            {/* Rows */}
            <div className="flex flex-col items-center gap-2">
              {/* Column headers */}
              <div className="flex items-center gap-1">
                <div className="w-8 text-center text-xs text-runway/50 font-mono">#</div>
                {sortedRows[0]?.[1]
                  .sort((a, b) => a.seatNo.localeCompare(b.seatNo))
                  .map(s => {
                    const col = s.seatNo.replace(/\d+/, '');
                    return (
                      <div key={col} className="w-9 text-center text-xs text-runway/50 font-mono">
                        {col}
                      </div>
                    );
                  })}
              </div>

              {sortedRows.map(([rowNum, rowSeats]) => {
                const sorted = [...rowSeats].sort((a, b) =>
                  a.seatNo.localeCompare(b.seatNo),
                );

                return (
                  <div key={rowNum} className="flex items-center gap-1">
                    <div className="w-8 text-center text-xs text-runway/50 font-mono">
                      {rowNum}
                    </div>
                    {sorted.map((seat, idx) => {
                      const isBooked = seat.status !== 'AVAILABLE';
                      const isSelected = selectedSeats
                        ? selectedSeats.includes(seat.id)
                        : selectedSeat === seat.id;
                      const col = seat.seatNo.replace(/\d+/, '');
                      const position = getSeatPosition(col);

                      // Add aisle gap after 3rd seat (ABC | DEF layout)
                      const hasAisle = idx === Math.floor(sorted.length / 2) - 1;

                      return (
                        <span key={seat.id} className="flex items-center">
                          <button
                            onClick={() => !isBooked && !disabled && onSelect(seat.id, seat.seatNo)}
                            disabled={isBooked || disabled}
                            title={
                              isBooked
                                ? `${seat.seatNo} — Booked`
                                : seat.fare
                                  ? `${seat.seatNo} — ${position} — ₹${seat.fare.toLocaleString()}`
                                  : `${seat.seatNo} — ${position}`
                            }
                            aria-label={`Seat ${seat.seatNo} ${position}`}
                            aria-pressed={isSelected}
                            className={cn(
                              'seat',
                              isSelected
                                ? colors.selected
                                : isBooked
                                  ? colors.booked
                                  : colors.available,
                            )}
                          >
                            {isSelected
                              ? (selectedSeats
                                  ? (selectedSeats.indexOf(seat.id) + 1).toString()
                                  : '✓')
                              : ''}
                          </button>
                          {hasAisle && <div className="w-4" />}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Tail decoration */}
      <div className="flex flex-col items-center">
        <div className="w-px h-4 bg-sky-light/30" />
        <div className="w-28 h-8 rounded-b-full border border-sky-light/40 bg-sky-mid/30 flex items-center justify-center">
          <span className="text-xs text-runway font-mono uppercase tracking-widest">
            Exit
          </span>
        </div>
      </div>
    </div>
  );
}
