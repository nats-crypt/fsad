import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Plane } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import DataTable from '../../components/DataTable';
import CrudModal from '../../components/CrudModal';
import { useToast } from '../../components/Toast';
import type { Aircraft } from '../../types';

function AircraftForm({
  initial,
  onChange,
}: {
  initial: Partial<Aircraft>;
  onChange: (v: Partial<Aircraft>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Registration *</label>
        <input
          className="input"
          value={initial.registration ?? ''}
          onChange={e => onChange({ ...initial, registration: e.target.value })}
          placeholder="e.g. VT-AXL"
          required
        />
      </div>
      <div>
        <label className="label">Model *</label>
        <input
          className="input"
          value={initial.model ?? ''}
          onChange={e => onChange({ ...initial, model: e.target.value })}
          placeholder="e.g. Airbus A320neo"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Capacity *</label>
          <input
            type="number"
            className="input"
            value={initial.capacity ?? ''}
            onChange={e => onChange({ ...initial, capacity: Number(e.target.value) })}
            min={1}
            max={600}
            required
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={initial.status ?? 'ACTIVE'}
            onChange={e => onChange({ ...initial, status: e.target.value })}
          >
            <option value="ACTIVE">Active</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="RETIRED">Retired</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default function AircraftAdmin() {
  const toast = useToast();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Aircraft | null>(null);
  const [form, setForm] = useState<Partial<Aircraft>>({});
  const [modalError, setModalError] = useState('');

  const { data, isLoading } = useQuery<Aircraft[]>({
    queryKey: ['aircraft'],
    queryFn: () => api.get<Aircraft[]>('/aircraft'),
  });

  const save = useMutation({
    mutationFn: (body: Partial<Aircraft>) =>
      editing
        ? api.put(`/aircraft/${editing.id}`, body)
        : api.post('/aircraft', body),
    onSuccess: () => {
      toast.success(editing ? 'Aircraft Updated' : 'Aircraft Created');
      void qc.invalidateQueries({ queryKey: ['aircraft'] });
      void qc.invalidateQueries({ queryKey: ['admin-aircraft'] });
      setModalOpen(false);
      setEditing(null);
    },
    onError: err => {
      if (err instanceof ApiError) setModalError(err.message);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/aircraft/${id}`),
    onSuccess: () => {
      toast.success('Aircraft Removed');
      void qc.invalidateQueries({ queryKey: ['aircraft'] });
      void qc.invalidateQueries({ queryKey: ['admin-aircraft'] });
    },
    onError: err => {
      if (err instanceof ApiError) toast.error('Delete Failed', err.message);
    },
  });

  function openCreate() {
    setEditing(null);
    setForm({});
    setModalError('');
    setModalOpen(true);
  }

  function openEdit(ac: Aircraft) {
    setEditing(ac);
    setForm({ ...ac });
    setModalError('');
    setModalOpen(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setModalError('');
    save.mutate(form);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-heading tracking-widest uppercase text-gold mb-1">
            Fleet Management
          </p>
          <h1 className="section-title flex items-center gap-2">
            <Plane className="w-7 h-7 text-gold" />
            Aircraft
          </h1>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Add Aircraft
        </button>
      </div>

      <DataTable<Aircraft>
        data={data ?? []}
        loading={isLoading}
        searchable
        searchKeys={['registration', 'model']}
        columns={[
          { key: 'registration', label: 'Registration', sortable: true },
          { key: 'model', label: 'Model', sortable: true },
          {
            key: 'capacity',
            label: 'Capacity',
            sortable: true,
            render: v => <span className="font-mono">{String(v)}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            render: v => (
              <span
                className={`badge ${
                  v === 'ACTIVE'
                    ? 'badge-green'
                    : v === 'MAINTENANCE'
                      ? 'badge-gold'
                      : 'badge-red'
                }`}
              >
                {String(v)}
              </span>
            ),
          },
        ]}
        actions={row => (
          <div className="flex items-center justify-end gap-2">
            <button
              className="btn-ghost btn-sm btn-icon"
              onClick={() => openEdit(row)}
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              className="btn-danger btn-sm btn-icon"
              onClick={() => {
                if (confirm(`Remove ${row.registration}?`)) remove.mutate(row.id);
              }}
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        emptyMessage="No aircraft in fleet"
      />

      <CrudModal
        title={editing ? 'Edit Aircraft' : 'Add Aircraft'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={save.isPending}
        submitLabel={editing ? 'Save Changes' : 'Add Aircraft'}
        error={modalError}
      >
        <AircraftForm initial={form} onChange={setForm} />
      </CrudModal>
    </div>
  );
}
