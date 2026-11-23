import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, LogIn, LogOut, Calendar, Loader2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import DataTable from '../../components/DataTable';
import { useToast } from '../../components/Toast';
import { formatDateTime, todayIST, dateIST } from '../../lib/utils';
import type { Employee, AttendanceRecord } from '../../types';

export default function Attendance() {
  const toast = useToast();
  const qc = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return dateIST(d);
  });
  const [dateTo, setDateTo] = useState(() => todayIST());

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/employees'),
  });

  const { data: records, isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', selectedEmployee, dateFrom, dateTo],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (selectedEmployee) sp.set('employeeId', selectedEmployee);
      if (dateFrom) sp.set('from', dateFrom);
      if (dateTo) sp.set('to', dateTo);
      return api.get<AttendanceRecord[]>(`/attendance?${sp.toString()}`);
    },
  });

  const mark = useMutation({
    mutationFn: ({ employeeId, type }: { employeeId: string; type: 'IN' | 'OUT' }) =>
      api.post('/attendance/mark', { employeeId, type }),
    onSuccess: (_, vars) => {
      toast.success(`Marked ${vars.type === 'IN' ? 'Check-In' : 'Check-Out'}`);
      void qc.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: err => {
      if (err instanceof ApiError) toast.error('Failed', err.message);
    },
  });

  const [markForm, setMarkForm] = useState({ employeeId: '', type: 'IN' as 'IN' | 'OUT' });

  function handleMark(e: FormEvent) {
    e.preventDefault();
    if (!markForm.employeeId) return;
    mark.mutate(markForm);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-heading tracking-widest uppercase text-gold mb-1">
          HR
        </p>
        <h1 className="section-title flex items-center gap-2">
          <Clock className="w-7 h-7 text-gold" />
          Attendance
        </h1>
      </div>

      {/* Mark attendance */}
      <div className="card border border-sky-light/30 p-5">
        <h2 className="font-heading text-lg font-semibold text-cloud mb-4">
          Mark Attendance
        </h2>
        <form onSubmit={handleMark} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">Employee *</label>
            <select
              className="input min-w-48"
              value={markForm.employeeId}
              onChange={e => setMarkForm(f => ({ ...f, employeeId: e.target.value }))}
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
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-primary"
              disabled={mark.isPending || !markForm.employeeId}
              onClick={() => setMarkForm(f => ({ ...f, type: 'IN' }))}
            >
              {mark.isPending && markForm.type === 'IN' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              Check In
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={mark.isPending || !markForm.employeeId}
              onClick={() => {
                setMarkForm(f => ({ ...f, type: 'OUT' }));
                if (markForm.employeeId) {
                  mark.mutate({ employeeId: markForm.employeeId, type: 'OUT' });
                }
              }}
            >
              {mark.isPending && markForm.type === 'OUT' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              Check Out
            </button>
          </div>
        </form>
      </div>

      {/* History filter */}
      <div className="card border border-sky-light/30 p-5">
        <h2 className="font-heading text-lg font-semibold text-cloud mb-4">
          Attendance History
        </h2>
        <div className="flex flex-wrap gap-4 mb-5">
          <div>
            <label className="label">Employee</label>
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

        <DataTable<AttendanceRecord>
          data={records ?? []}
          loading={isLoading}
          columns={[
            {
              key: 'employee',
              label: 'Employee',
              render: (_, row) => (
                <span>
                  {row.employee?.fullName ?? row.employeeId}
                </span>
              ),
            },
            {
              key: 'date',
              label: 'Date',
              sortable: true,
              render: v => formatDateTime(String(v)).split(' ')[0],
            },
            {
              key: 'checkIn',
              label: 'Check In',
              render: v => v ? formatDateTime(String(v)) : '—',
            },
            {
              key: 'checkOut',
              label: 'Check Out',
              render: v => v ? formatDateTime(String(v)) : '—',
            },
            {
              key: 'status',
              label: 'Status',
              render: v => (
                <span
                  className={`badge ${v === 'PRESENT' ? 'badge-green' : v === 'ABSENT' ? 'badge-red' : 'badge-gold'}`}
                >
                  {String(v)}
                </span>
              ),
            },
          ]}
          emptyMessage="No attendance records"
        />
      </div>
    </div>
  );
}
