import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiUserPlus } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import API from '../api/axios';
import { useApi } from '../hooks/useApi';
import { PageHeader, Card, Modal, DataTable, Badge, Field } from '../components/ui.jsx';
import { BASES, ROLE_META } from '../lib/constants';
import { fmtDate } from '../lib/format';

const PERMISSIONS = [
  ['Dashboard & inventory', 'All bases', 'Own base', 'Own base'],
  ['Record purchases', '✓', 'Own base', 'Own base'],
  ['Transfers', 'Execute any', 'Execute from own base', 'Request only'],
  ['Approve transfers', '✓', 'Outgoing from own base', '—'],
  ['Assign / expend assets', '✓', 'Own base', '—'],
  ['Audit log', 'All bases', 'Own base', '—'],
  ['Manage users', '✓', '—', '—'],
];

export default function Users() {
  const { user: me } = useAuth();
  const { data, loading, error, reload } = useApi('/users');
  const [open, setOpen] = useState(false);
  const empty = { name: '', email: '', password: '', role: 'logistics_officer', base: 'Base Alpha' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const update = async (u, patch) => {
    try {
      await API.put(`/users/${u._id}`, patch);
      toast.success('User updated');
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await API.post('/users', form);
      toast.success(`${form.name} created`);
      setForm(empty);
      setOpen(false);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create user');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'name', header: 'Name', render: (u) => <div><div className="cell-title">{u.name}{u._id === me.id && <span className="muted"> (you)</span>}</div><div className="cell-sub mono">{u.email}</div></div>, sort: (u) => u.name, csv: (u) => u.name },
    { key: 'role', header: 'Role', render: (u) => (
      <select className="input" style={{ minHeight: 32, padding: '.25rem 2rem .25rem .6rem', width: 170 }} value={u.role} disabled={u._id === me.id} onChange={(e) => update(u, { role: e.target.value })}>
        {Object.entries(ROLE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
      </select>
    ), sort: (u) => u.role, csv: (u) => u.role },
    { key: 'base', header: 'Base', render: (u) => (
      <select className="input" style={{ minHeight: 32, padding: '.25rem 2rem .25rem .6rem', width: 140 }} value={u.base} onChange={(e) => update(u, { base: e.target.value })}>
        {BASES.map((b) => <option key={b}>{b}</option>)}
      </select>
    ), sort: (u) => u.base, csv: (u) => u.base },
    { key: 'isActive', header: 'Status', render: (u) => <Badge tone={u.isActive ? 'green' : 'slate'} dot>{u.isActive ? 'Active' : 'Deactivated'}</Badge>, sort: (u) => (u.isActive ? 1 : 0), csv: (u) => (u.isActive ? 'active' : 'deactivated') },
    { key: 'createdAt', header: 'Created', render: (u) => <span className="muted">{fmtDate(u.createdAt)}</span>, sort: (u) => new Date(u.createdAt).getTime(), csv: (u) => fmtDate(u.createdAt) },
    { key: 'actions', header: '', render: (u) => u._id !== me.id && (
      <button className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-success'}`} onClick={() => update(u, { isActive: !u.isActive })}>
        {u.isActive ? 'Deactivate' : 'Reactivate'}
      </button>
    ) },
  ];

  return (
    <div className="stack">
      <PageHeader eyebrow="Administration" title="Users & roles" subtitle="Role-based access control: every permission below is enforced by API middleware, not just hidden in the UI.">
        <button className="btn btn-primary" onClick={() => setOpen(true)}><FiUserPlus /> Add user</button>
      </PageHeader>

      <Card bodyClass="">
        <DataTable columns={columns} rows={data?.map((u) => ({ ...u, _id: String(u._id) }))} loading={loading} error={error} exportName="users" initialSort={{ key: 'role', dir: 'asc' }} />
      </Card>

      <Card title="Permission matrix" subtitle="What each role can do" bodyClass="">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Capability</th>{Object.values(ROLE_META).map((m) => <th key={m.label} style={{ color: m.color }}>{m.label}</th>)}</tr></thead>
            <tbody>
              {PERMISSIONS.map(([cap, ...vals]) => (
                <tr key={cap}><td className="cell-title">{cap}</td>{vals.map((v, i) => <td key={i} className={v === '—' ? 'muted' : 'secondary'}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add user"
        footer={<><button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" form="user-form" disabled={saving}>{saving ? <span className="spinner" /> : 'Create user'}</button></>}>
        <form id="user-form" className="form-grid" onSubmit={create}>
          <Field label="Full name *" className="full"><input className="input" required value={form.name} onChange={set('name')} placeholder="Capt. Jane Doe" /></Field>
          <Field label="Email *"><input className="input" type="email" required value={form.email} onChange={set('email')} /></Field>
          <Field label="Temporary password *" hint="Min. 6 characters"><input className="input" type="password" minLength={6} required value={form.password} onChange={set('password')} /></Field>
          <Field label="Role">
            <select className="input" value={form.role} onChange={set('role')}>{Object.entries(ROLE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}</select>
          </Field>
          <Field label="Base"><select className="input" value={form.base} onChange={set('base')}>{BASES.map((b) => <option key={b}>{b}</option>)}</select></Field>
        </form>
      </Modal>
    </div>
  );
}
