import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import DataTable from '../../components/DataTable';
import CrudModal from '../../components/CrudModal';
import { useToast } from '../../components/Toast';
import { formatCurrency } from '../../lib/utils';
import type { Employee } from '../../types';

function EmployeeForm({
  initial,
  onChange,
}: {
  initial: Partial<Employee>;
  onChange: (v: Partial<Employee>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Employee Code *</label>
          <input
            className="input font-mono"
            value={initial.empCode ?? ''}
            onChange={e => onChange({ ...initial, empCode: e.target.value })}
            placeholder="EMP001"
            required
          />
        </div>
        <div>
          <label className="label">Full Name *</label>
          <input
            className="input"
            value={initial.fullName ?? ''}
            onChange={e => onChange({ ...initial, fullName: e.target.value })}
            placeholder="John Smith"
            required
          />
        </div>
      </div>
      <div>
        <label className="label">Designation *</label>
        <select
          className="input"
          value={initial.designation ?? ''}
          onChange={e => onChange({ ...initial, designation: e.target.value })}
          required
        >
          <option value="">Select…</option>
          {[
            'Captain',
            'First Officer',
            'Cabin Crew',
            'Ground Staff',
            'Operations Manager',
            'Maintenance Engineer',
            'Security Officer',
          ].map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Duty Area</label>
          <input
            className="input"
            value={initial.dutyArea ?? ''}
            onChange={e => onChange({ ...initial, dutyArea: e.target.value })}
            placeholder="Terminal 1 / Flight Ops"
          />
        </div>
        <div>
          <label className="label">Salary (₹)</label>
          <input
            type="number"
            className="input"
            value={initial.salary ?? ''}
            onChange={e => onChange({ ...initial, salary: Number(e.target.value) })}
            min={0}
            placeholder="50000"
          />
        </div>
      </div>
      <div>
        <label className="label">Contact</label>
        <input
          className="input"
          type="tel"
          value={initial.contact ?? ''}
          onChange={e => onChange({ ...initial, contact: e.target.value })}
          placeholder="+91 98765 43210"
        />
      </div>
    </div>
  );
}

export default function EmployeesAdmin() {
  const toast = useToast();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<Partial<Employee>>({});
  const [modalError, setModalError] = useState('');

  const { data, isLoading } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/employees'),
  });

  const save = useMutation({
    mutationFn: (body: Partial<Employee>) =>
      editing
        ? api.put(`/employees/${editing.id}`, body)
        : api.post('/employees', body),
    onSuccess: () => {
      toast.success(editing ? 'Employee Updated' : 'Employee Added');
      void qc.invalidateQueries({ queryKey: ['employees'] });
      void qc.invalidateQueries({ queryKey: ['admin-employees'] });
      setModalOpen(false);
      setEditing(null);
    },
    onError: err => {
      if (err instanceof ApiError) setModalError(err.message);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/employees/${id}`),
    onSuccess: () => {
      toast.success('Employee Removed');
      void qc.invalidateQueries({ queryKey: ['employees'] });
      void qc.invalidateQueries({ queryKey: ['admin-employees'] });
    },
    onError: err => {
      if (err instanceof ApiError) toast.error('Delete Failed', err.message);
    },
  });

  function openCreate() {
    setEditing(null);
    setForm({ salary: 0 });
    setModalError('');
    setModalOpen(true);
  }

  function openEdit(e: Employee) {
    setEditing(e);
    setForm({ ...e });
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
            HR Management
          </p>
          <h1 className="section-title flex items-center gap-2">
            <Users className="w-7 h-7 text-gold" />
            Employees
          </h1>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      <DataTable<Employee>
        data={data ?? []}
        loading={isLoading}
        searchable
        searchKeys={['empCode', 'fullName', 'designation']}
        columns={[
          {
            key: 'empCode',
            label: 'Code',
            sortable: true,
            render: v => <span className="font-mono text-gold">{String(v)}</span>,
          },
          { key: 'fullName', label: 'Name', sortable: true },
          { key: 'designation', label: 'Role', sortable: true },
          {
            key: 'dutyArea',
            label: 'Duty Area',
            render: v => <span className="text-runway">{String(v ?? '—')}</span>,
          },
          {
            key: 'salary',
            label: 'Salary',
            sortable: true,
            render: v => formatCurrency(Number(v)),
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
                if (confirm(`Remove ${row.fullName}?`)) remove.mutate(row.id);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        emptyMessage="No employees found"
      />

      <CrudModal
        title={editing ? 'Edit Employee' : 'Add Employee'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={save.isPending}
        submitLabel={editing ? 'Save Changes' : 'Add Employee'}
        error={modalError}
        size="lg"
      >
        <EmployeeForm initial={form} onChange={setForm} />
      </CrudModal>
    </div>
  );
}
