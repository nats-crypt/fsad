import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '../lib/utils';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  pageSize?: number;
  searchable?: boolean;
  searchKeys?: (keyof T)[];
  actions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
}

export default function DataTable<T extends { id: string }>({
  data,
  columns,
  loading,
  emptyMessage = 'No records found',
  pageSize = 10,
  searchable = false,
  searchKeys = [],
  actions,
  onRowClick,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  function getValue(row: T, key: string): unknown {
    const keys = key.split('.');
    let val: unknown = row;
    for (const k of keys) {
      val = (val as Record<string, unknown>)?.[k];
    }
    return val;
  }

  const filtered = searchable && search
    ? data.filter(row =>
        searchKeys.some(k => {
          const v = getValue(row, String(k));
          return String(v ?? '').toLowerCase().includes(search.toLowerCase());
        }),
      )
    : data;

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const av = getValue(a, sortKey);
        const bv = getValue(b, sortKey);
        const cmp =
          String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
            numeric: true,
          });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : filtered;

  const totalPages = Math.ceil(sorted.length / pageSize);
  const page_ = Math.min(page, Math.max(0, totalPages - 1));
  const paged = sorted.slice(page_ * pageSize, (page_ + 1) * pageSize);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  }

  return (
    <div className="card overflow-hidden">
      {searchable && (
        <div className="p-4 border-b border-sky-light/20">
          <div className="input-group max-w-xs">
            <Search className="input-icon w-4 h-4" />
            <input
              className="input input-sm"
              placeholder="Search..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sky-light/20">
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  className={cn(
                    'px-4 py-3 text-left',
                    'text-xs font-heading tracking-widest uppercase text-runway',
                    col.sortable && 'cursor-pointer hover:text-cloud select-none',
                    col.headerClassName,
                  )}
                  onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === String(col.key) && (
                      sortDir === 'asc'
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                    )}
                  </span>
                </th>
              ))}
              {actions && (
                <th className="px-4 py-3 text-right text-xs font-heading tracking-widest uppercase text-runway">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-sky-light/10">
                  {columns.map(col => (
                    <td key={String(col.key)} className="px-4 py-3">
                      <div className="h-4 bg-sky-light/20 rounded animate-pulse" />
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3">
                      <div className="h-4 w-16 bg-sky-light/20 rounded animate-pulse ml-auto" />
                    </td>
                  )}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="text-center py-12 text-runway font-heading tracking-wide"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map(row => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-sky-light/10 table-row-hover',
                    onRowClick && 'cursor-pointer',
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map(col => (
                    <td
                      key={String(col.key)}
                      className={cn('px-4 py-3 text-cloud/90', col.className)}
                    >
                      {col.render
                        ? col.render(getValue(row, String(col.key)), row)
                        : String(getValue(row, String(col.key)) ?? '—')}
                    </td>
                  ))}
                  {actions && (
                    <td
                      className="px-4 py-3 text-right"
                      onClick={e => e.stopPropagation()}
                    >
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-sky-light/20">
          <p className="text-xs text-runway">
            {sorted.length} record{sorted.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="btn-icon btn-sm text-runway hover:text-cloud"
              disabled={page_ === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-runway font-mono">
              {page_ + 1} / {totalPages}
            </span>
            <button
              className="btn-icon btn-sm text-runway hover:text-cloud"
              disabled={page_ >= totalPages - 1}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
