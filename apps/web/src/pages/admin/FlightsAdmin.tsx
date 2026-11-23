import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import DataTable from '../../components/DataTable';
import CrudModal from '../../components/CrudModal';
import { useToast } from '../../components/Toast';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import type { Flight, Aircraft } from '../../types';

const AIRPORTS = ['DEL', 'BOM', 'BLR', 'HYD', 'MAA', 'CCU'];

function FlightForm({
  initial,
  onChange,
  aircraft,
}: {
  initial: Partial<Record<string, unknown>>;
  onChange: (v: Partial<Record<string, unknown>>) => void;
  aircraft: Aircraft[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Flight No. *</label>
          <input
            className="input font-mono"
            value={String(initial['flightNo'] ?? '')}
            onChange={e => onChange({ ...initial, flightNo: e.target.value })}
            placeholder="HZ101"
            required
          />
        </div>
        <div>
          <label className="label">Aircraft *</label>
          <select
            className="input"
            value={String(initial['aircraftId'] ?? '')}
            onChange={e => onChange({ ...initial, aircraftId: e.target.value })}
            required
          >
            <option value="">Select aircraft…</option>
            {aircraft.map(a => (
              <option key={a.id} value={a.id}>
                {a.registration} — {a.model}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Origin *</label>
          <select
            className="input"
            value={String(initial['originCode'] ?? '')}
            onChange={e => onChange({ ...initial, originCode: e.target.value })}
            required
          >
            <option value="">Select origin…</option>
            {AIRPORTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Destination *</label>
          <select
            className="input"
            value={String(initial['destinationCode'] ?? '')}
            onChange={e => onChange({ ...initial, destinationCode: e.target.value })}
            required
          >
            <option value="">Select destination…</option>
            {AIRPORTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Depart At *</label>
          <input
            type="datetime-local"
            className="input"
            value={String(initial['departAt'] ?? '')}
            onChange={e => onChange({ ...initial, departAt: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Arrive At *</label>
          <input
            type="datetime-local"
            className="input"
            value={String(initial['arriveAt'] ?? '')}
            onChange={e => onChange({ ...initial, arriveAt: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Base Fare (₹) *</label>
          <input
            type="number"
            className="input"
            value={String(initial['baseFare'] ?? '')}
            onChange={e => onChange({ ...initial, baseFare: Number(e.target.value) })}
            min={0}
            required
          />
        </div>
        <div>
          <label className="label">Capacity *</label>
          <input
            type="number"
            className="input"
            value={String(initial['capacity'] ?? '')}
            onChange={e => onChange({ ...initial, capacity: Number(e.target.value) })}
            min={1}
            placeholder="e.g. 180"
            required
          />
        </div>
      </div>
      <div>
        <label className="label">Status</label>
        <select
          className="input"
          value={String(initial['status'] ?? 'SCHEDULED')}
          onChange={e => onChange({ ...initial, status: e.target.value })}
        >
          <option value="SCHEDULED">Scheduled</option>
          <option value="DEPARTED">Departed</option>
          <option value="ARRIVED">Arrived</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>
    </div>
  );
}

export default function FlightsAdmin() {
  const toast = useToast();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Flight | null>(null);
  const [form, setForm] = useState<Partial<Record<string, unknown>>>({});
  const [modalError, setModalError] = useState('');

  const { data: flights, isLoading } = useQuery<Flight[]>({
    queryKey: ['admin-flights'],
    queryFn: () => api.get<Flight[]>('/flights/all'),
  });

  const { data: aircraft } = useQuery<Aircraft[]>({
    queryKey: ['aircraft'],
    queryFn: () => api.get<Aircraft[]>('/aircraft'),
  });

  const save = useMutation({
    mutationFn: (body: Partial<Record<string, unknown>>) =>
      editing
        ? api.put(`/flights/${editing.id}`, body)
        : api.post('/flights', body),
    onSuccess: () => {
      toast.success(editing ? 'Flight Updated' : 'Flight Scheduled');
      void qc.invalidateQueries({ queryKey: ['admin-flights'] });
      void qc.invalidateQueries({ queryKey: ['flights'] });
      setModalOpen(false);
      setEditing(null);
    },
    onError: err => {
      if (err instanceof ApiError) setModalError(err.message);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/flights/${id}`),
    onSuccess: () => {
      toast.success('Flight Removed');
      void qc.invalidateQueries({ queryKey: ['admin-flights'] });
      void qc.invalidateQueries({ queryKey: ['flights'] });
    },
    onError: err => {
      if (err instanceof ApiError) toast.error('Delete Failed', err.message);
    },
  });

  function openCreate() {
    setEditing(null);
    setForm({ status: 'SCHEDULED' });
    setModalError('');
    setModalOpen(true);
  }

  function openEdit(f: Flight) {
    setEditing(f);
    setForm({
      flightNo: f.flightNo,
      originCode: f.origin.code,
      destinationCode: f.destination.code,
      departAt: f.departAt.slice(0, 16),
      arriveAt: f.arriveAt.slice(0, 16),
      baseFare: f.baseFare,
      capacity: f.capacity,
      status: f.status,
      aircraftId: undefined,
    });
    setModalError('');
    setModalOpen(true);
  }

  function toIso(val: unknown): string | undefined {
    if (!val) return undefined;
    const s = String(val);
    if (s.includes('Z') || s.includes('+')) return s;
    return new Date(s).toISOString();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setModalError('');
    const payload = {
      ...form,
      ...(form.departAt ? { departAt: toIso(form.departAt) } : {}),
      ...(form.arriveAt ? { arriveAt: toIso(form.arriveAt) } : {}),
    };
    save.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-heading tracking-widest uppercase text-gold mb-1">
            Scheduling
          </p>
          <h1 className="section-title flex items-center gap-2">
            <Calendar className="w-7 h-7 text-gold" />
            Flights
          </h1>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Schedule Flight
        </button>
      </div>

      <DataTable<Flight>
        data={flights ?? []}
        loading={isLoading}
        searchable
        searchKeys={['flightNo'] as (keyof Flight)[]}
        columns={[
          {
            key: 'flightNo',
            label: 'Flight',
            sortable: true,
            render: v => <span className="font-mono text-gold">{String(v)}</span>,
          },
          {
            key: 'origin',
            label: 'Route',
            render: (_, row) => (
              <span className="font-mono">
                {row.origin.code} → {row.destination.code}
              </span>
            ),
          },
          {
            key: 'departAt',
            label: 'Depart',
            sortable: true,
            render: v => formatDateTime(String(v)),
          },
          {
            key: 'baseFare',
            label: 'Base Fare',
            sortable: true,
            render: v => formatCurrency(Number(v)),
          },
          {
            key: 'seatsLeft',
            label: 'Seats Left',
            render: (_, row) => (
              <span className="font-mono">
                {row.seatsLeft}/{row.capacity}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: v => {
              const c = {
                SCHEDULED: 'badge-green',
                DEPARTED: 'badge-blue',
                ARRIVED: 'badge-gray',
                CANCELLED: 'badge-red',
              }[String(v)] ?? 'badge-gray';
              return <span className={`badge ${c}`}>{String(v)}</span>;
            },
          },
        ]}
        actions={row => (
          <div className="flex items-center justify-end gap-2">
            <button
              className="btn-ghost btn-sm btn-icon"
              onClick={() => openEdit(row)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              className="btn-danger btn-sm btn-icon"
              onClick={() => {
                if (confirm(`Remove flight ${row.flightNo}?`)) remove.mutate(row.id);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        emptyMessage="No flights scheduled"
      />

      <CrudModal
        title={editing ? 'Edit Flight' : 'Schedule Flight'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={save.isPending}
        submitLabel={editing ? 'Save Changes' : 'Schedule'}
        error={modalError}
        size="lg"
      >
        <FlightForm
          initial={form}
          onChange={setForm}
          aircraft={aircraft ?? []}
        />
      </CrudModal>
    </div>
  );
}
