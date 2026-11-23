import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, UserCheck, Users } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import DataTable from '../../components/DataTable';
import CrudModal from '../../components/CrudModal';
import { useToast } from '../../components/Toast';
import { formatDateTime } from '../../lib/utils';
import type { Flight, Employee, CrewAssignment } from '../../types';

export default function CrewAdmin() {
  const toast = useToast();
  const qc = useQueryClient();
  const [selectedFlight, setSelectedFlight] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ flightId: '', employeeId: '', role: 'CREW' });
  const [modalError, setModalError] = useState('');

  const { data: flights } = useQuery<Flight[]>({
    queryKey: ['admin-flights'],
    queryFn: () => api.get<Flight[]>('/flights/all'),
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/employees'),
  });

  const { data: crew, isLoading } = useQuery<CrewAssignment[]>({
    queryKey: ['crew', selectedFlight],
    queryFn: () => {
      const sp = selectedFlight ? `?flightId=${selectedFlight}` : '';
      return api.get<CrewAssignment[]>(`/crew${sp}`);
    },
  });

  const assign = useMutation({
    mutationFn: (body: typeof form) => api.post('/crew', body),
    onSuccess: () => {
      toast.success('Crew Assigned');
      void qc.invalidateQueries({ queryKey: ['crew'] });
      setModalOpen(false);
    },
    onError: err => {
      if (err instanceof ApiError) setModalError(err.message);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/crew/${id}`),
    onSuccess: () => {
      toast.success('Assignment Removed');
      void qc.invalidateQueries({ queryKey: ['crew'] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setModalError('');
    assign.mutate(form);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-heading tracking-widest uppercase text-gold mb-1">
            Crew Management
          </p>
          <h1 className="section-title flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-gold" />
            Crew Assignments
          </h1>
        </div>
        <button className="btn-primary" onClick={() => { setModalError(''); setForm({ flightId: selectedFlight, employeeId: '', role: 'CREW' }); setModalOpen(true); }}>
          <Plus className="w-4 h-4" />
          Assign Crew
        </button>
      </div>

      {/* Flight filter */}
      <div className="card border border-sky-light/30 p-4">
        <label className="label">Filter by Flight</label>
        <select
          className="input max-w-xs"
          value={selectedFlight}
          onChange={e => setSelectedFlight(e.target.value)}
        >
          <option value="">All flights</option>
          {flights?.map(f => (
            <option key={f.id} value={f.id}>
              {f.flightNo} — {f.origin.code}→{f.destination.code}{' '}
              {formatDateTime(f.departAt)}
            </option>
          ))}
        </select>
      </div>

      <DataTable<CrewAssignment>
        data={crew ?? []}
        loading={isLoading}
        columns={[
          {
            key: 'employee',
            label: 'Employee',
            render: (_, row) => (
              <div>
                <p className="text-cloud">{row.employee?.fullName ?? '—'}</p>
                <p className="text-xs text-runway font-mono">
                  {row.employee?.empCode ?? ''}
                </p>
              </div>
            ),
          },
          {
            key: 'role',
            label: 'Role',
            render: v => <span className="badge badge-blue">{String(v)}</span>,
          },
          {
            key: 'flight',
            label: 'Flight',
            render: (_, row) => (
              <span className="font-mono text-gold">
                {row.flight?.flightNo ?? '—'}
              </span>
            ),
          },
          {
            key: 'employee',
            label: 'Designation',
            render: (_, row) => (
              <span className="text-runway">{row.employee?.designation ?? '—'}</span>
            ),
          },
        ]}
        actions={row => (
          <button
            className="btn-danger btn-sm btn-icon"
            onClick={() => {
              if (confirm('Remove crew assignment?')) remove.mutate(row.id);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        emptyMessage="No crew assignments"
      />

      <CrudModal
        title="Assign Crew"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={assign.isPending}
        submitLabel="Assign"
        error={modalError}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Flight *</label>
            <select
              className="input"
              value={form.flightId}
              onChange={e => setForm(f => ({ ...f, flightId: e.target.value }))}
              required
            >
              <option value="">Select flight…</option>
              {flights?.map(f => (
                <option key={f.id} value={f.id}>
                  {f.flightNo} — {f.origin.code}→{f.destination.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Employee *</label>
            <select
              className="input"
              value={form.employeeId}
              onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
              required
            >
              <option value="">Select employee…</option>
              {employees?.map(e => (
                <option key={e.id} value={e.id}>
                  {e.empCode} — {e.fullName} ({e.designation})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Role *</label>
            <select
              className="input"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            >
              <option value="CAPTAIN">Captain</option>
              <option value="FIRST_OFFICER">First Officer</option>
              <option value="CREW">Cabin Crew</option>
              <option value="PURSER">Purser</option>
            </select>
          </div>
        </div>
      </CrudModal>
    </div>
  );
}
