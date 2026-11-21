import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Play, Square, Loader2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import DataTable from '../../components/DataTable';
import { useToast } from '../../components/Toast';
import { formatDateTime } from '../../lib/utils';
import type { Employee, DutyReport } from '../../types';

export default function Duty() {
  const toast = useToast();
  const qc = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState('');

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/employees'),
  });

  const { data: duties, isLoading } = useQuery<DutyReport[]>({
    queryKey: ['duty', selectedEmployee],
    queryFn: () => {
      const sp = selectedEmployee ? `?employeeId=${selectedEmployee}` : '';
      return api.get<DutyReport[]>(`/duty${sp}`);
    },
  });

  const [form, setForm] = useState({
    employeeId: '',
    dutyArea: '',
    startAt: new Date().toISOString().slice(0, 16),
  });

  const start = useMutation({
    mutationFn: (body: typeof form) => api.post('/duty', body),
    onSuccess: () => {
      toast.success('Duty Started');
      void qc.invalidateQueries({ queryKey: ['duty'] });
    },
    onError: err => {
      if (err instanceof ApiError) toast.error('Failed', err.message);
    },
  });

  const end = useMutation({
    mutationFn: (id: string) => api.post(`/duty/${id}/end`),
    onSuccess: () => {
      toast.success('Duty Ended');
      void qc.invalidateQueries({ queryKey: ['duty'] });
    },
  });

  function handleStart(e: FormEvent) {
    e.preventDefault();
    start.mutate(form);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-heading tracking-widest uppercase text-gold mb-1">
          HR
        </p>
        <h1 className="section-title flex items-center gap-2">
          <Settings className="w-7 h-7 text-gold" />
          Duty Reports
        </h1>
      </div>

      {/* Start duty form */}
      <div className="card border border-sky-light/30 p-5">
        <h2 className="font-heading text-lg font-semibold text-cloud mb-4">
          Start Duty
        </h2>
        <form onSubmit={handleStart} className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label">Employee *</label>
            <select
              className="input min-w-48"
              value={form.employeeId}
              onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
              required
            >
              <option value="">Select employee…</option>
              {employees?.map(e => (
                <option key={e.id} value={e.id}>
                  {e.empCode} — {e.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Duty Area *</label>
            <select
              className="input min-w-48"
              value={form.dutyArea}
              onChange={e => setForm(f => ({ ...f, dutyArea: e.target.value }))}
              required
            >
              <option value="">Select area…</option>
              {[
                'Terminal 1',
                'Terminal 2',
                'Terminal 3',
                'Runway',
                'Ground Ops',
                'Cabin',
                'Cockpit',
                'Maintenance Bay',
                'Security Gate',
              ].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Start At *</label>
            <input
              type="datetime-local"
              className="input"
              value={form.startAt}
              onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))}
              required
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={start.isPending}
          >
            {start.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Start Duty
          </button>
        </form>
      </div>

      {/* Duty records */}
      <div className="card border border-sky-light/30 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-semibold text-cloud">
            Duty History
          </h2>
          <div>
            <label className="label">Filter Employee</label>
            <select
              className="input min-w-48"
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
            >
              <option value="">All employees</option>
              {employees?.map(e => (
                <option key={e.id} value={e.id}>
                  {e.empCode} — {e.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable<DutyReport>
          data={duties ?? []}
          loading={isLoading}
          columns={[
            {
              key: 'employee',
              label: 'Employee',
              render: (_, row) => <span>{row.employee?.fullName ?? row.employeeId}</span>,
            },
            { key: 'dutyArea', label: 'Area', sortable: true },
            {
              key: 'startAt',
              label: 'Start',
              sortable: true,
              render: v => formatDateTime(String(v)),
            },
            {
              key: 'endAt',
              label: 'End',
              render: v => v ? formatDateTime(String(v)) : (
                <span className="badge badge-green">Active</span>
              ),
            },
          ]}
          actions={row => !row.endAt ? (
            <button
              className="btn-secondary btn-sm"
              onClick={() => end.mutate(row.id)}
              disabled={end.isPending}
            >
              {end.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
              End Duty
            </button>
          ) : null}
          emptyMessage="No duty reports"
        />
      </div>
    </div>
  );
}
