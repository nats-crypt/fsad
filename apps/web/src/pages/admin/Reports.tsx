import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Download, Loader2, AlertCircle, Calendar } from 'lucide-react';
import { api } from '../../lib/api';
import ReportChart from '../../components/ReportChart';
import type { Report, ReportType } from '../../types';
import { downloadCSV, formatCurrency } from '../../lib/utils';

const REPORT_TYPES: { value: ReportType; label: string; prefix?: string; chartType?: 'bar' | 'line' | 'area' }[] = [
  { value: 'revenue', label: 'Revenue', prefix: '₹', chartType: 'area' },
  { value: 'flights', label: 'Flights', chartType: 'bar' },
  { value: 'reservations', label: 'Reservations', chartType: 'area' },
  { value: 'cancellations', label: 'Cancellations', chartType: 'bar' },
  { value: 'aircraft', label: 'Aircraft Utilization', chartType: 'bar' },
  { value: 'salary', label: 'Salary', prefix: '₹', chartType: 'bar' },
  { value: 'employees', label: 'Employees', chartType: 'bar' },
  { value: 'attendance', label: 'Attendance', chartType: 'area' },
  { value: 'performance', label: 'Performance', chartType: 'line' },
];

export default function Reports() {
  const [urlSp] = useSearchParams();
  const [reportType, setReportType] = useState<ReportType>(
    (urlSp.get('type') as ReportType) ?? 'revenue',
  );
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const { data, isLoading, isError } = useQuery<Report>({
    queryKey: ['report', reportType, dateFrom, dateTo],
    queryFn: () => {
      const sp = new URLSearchParams({ from: dateFrom, to: dateTo });
      return api.get<Report>(`/reports/${reportType}?${sp.toString()}`);
    },
  });

  const selectedConfig = REPORT_TYPES.find(r => r.value === reportType)!;

  function handleExport() {
    if (!data?.series.length) return;
    downloadCSV(
      `horizon-${reportType}-${dateFrom}-${dateTo}.csv`,
      data.series.map(s => ({ label: s.label, value: s.value })),
    );
  }

  const summaryEntries = data?.summary ? Object.entries(data.summary) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-heading tracking-widest uppercase text-gold mb-1">
            Analytics
          </p>
          <h1 className="section-title flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-gold" />
            Reports
          </h1>
        </div>
        <button
          className="btn-secondary btn-sm"
          onClick={handleExport}
          disabled={!data?.series.length}
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Controls */}
      <div className="card border border-sky-light/30 p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label">Report Type</label>
            <select
              className="input min-w-48"
              value={reportType}
              onChange={e => setReportType(e.target.value as ReportType)}
            >
              {REPORT_TYPES.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <div className="input-group">
              <Calendar className="input-icon w-4 h-4" />
              <input
                type="date"
                className="input pl-11"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">To</label>
            <div className="input-group">
              <Calendar className="input-icon w-4 h-4" />
              <input
                type="date"
                className="input pl-11"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-3 py-16 card">
          <Loader2 className="w-8 h-8 text-gold animate-spin" />
          <span className="text-runway font-heading tracking-widest">
            Generating report…
          </span>
        </div>
      )}

      {isError && (
        <div className="card border border-ember/30 p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-ember flex-shrink-0" />
          <p className="text-runway">Failed to load report. Please try again.</p>
        </div>
      )}

      {!isLoading && !isError && data && (
        <>
          {/* Summary stats */}
          {summaryEntries.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-reveal">
              {summaryEntries.slice(0, 4).map(([key, val]) => (
                <div key={key} className="stat-card">
                  <p className="text-xs font-heading tracking-widest uppercase text-runway">
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-2xl font-heading font-bold text-cloud">
                    {typeof val === 'number'
                      ? selectedConfig.prefix
                        ? formatCurrency(val)
                        : val.toLocaleString()
                      : String(val)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Chart */}
          {data.series.length > 0 ? (
            <ReportChart
              series={data.series}
              type={selectedConfig.chartType ?? 'bar'}
              title={selectedConfig.label}
              valuePrefix={selectedConfig.prefix}
              height={320}
            />
          ) : (
            <div className="card p-12 text-center">
              <p className="text-runway font-heading">No data for this period</p>
            </div>
          )}

          {/* Data table */}
          {data.series.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-sky-light/20 flex items-center justify-between">
                <h3 className="font-heading text-sm tracking-widest uppercase text-runway">
                  Data Table
                </h3>
                <span className="text-xs text-runway">{data.series.length} records</span>
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-sky-dark">
                    <tr className="border-b border-sky-light/20">
                      <th className="px-4 py-3 text-left text-xs font-heading tracking-widest uppercase text-runway">
                        Label
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-heading tracking-widest uppercase text-runway">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.series.map((s, i) => (
                      <tr
                        key={i}
                        className="border-b border-sky-light/10 hover:bg-sky-light/10"
                      >
                        <td className="px-4 py-2.5 text-cloud/90">{s.label}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gold">
                          {selectedConfig.prefix
                            ? formatCurrency(s.value)
                            : s.value.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
