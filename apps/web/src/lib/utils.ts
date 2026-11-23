import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';

/** Returns today's date as YYYY-MM-DD in IST (UTC+5:30) */
export function todayIST(): string {
  return dateIST(new Date());
}

/** Returns any Date as YYYY-MM-DD in IST (UTC+5:30) */
export function dateIST(d: Date): string {
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string, opts?: Intl.DateTimeFormatOptions): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  });
}

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDateTime(dateStr: string): string {
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
}

export function getDuration(depart: string, arrive: string): string {
  const diff = new Date(arrive).getTime() - new Date(depart).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      headers
        .map(h => {
          const val = row[h];
          const str = val === null || val === undefined ? '' : String(val);
          return str.includes(',') ? `"${str}"` : str;
        })
        .join(','),
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function getLoadFactorColor(factor: number): string {
  if (factor >= 0.85) return 'text-ember';
  if (factor >= 0.65) return 'text-gold';
  return 'text-jade';
}

export function getFlagColor(flag: 'OVER' | 'UNDER' | 'OK'): string {
  if (flag === 'OVER') return 'text-ember bg-ember/10 border-ember/30';
  if (flag === 'UNDER') return 'text-gold bg-gold/10 border-gold/30';
  return 'text-jade bg-jade/10 border-jade/30';
}
