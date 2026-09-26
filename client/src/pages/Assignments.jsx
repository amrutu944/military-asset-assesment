import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiUserPlus, FiZap, FiCornerUpLeft, FiSearch, FiUsers, FiPackage } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import API from '../api/axios';
import { useApi } from '../hooks/useApi';
import {
  PageHeader, Card, Kpi, Modal, DataTable, TypeBadge, StatusBadge, Badge, Field, DatePresets, BaseSelect, TypeSelect,
} from '../components/ui.jsx';
import { BASES, EXPENDITURE_REASONS, MOVE } from '../lib/constants';
import { fmtNum, fmtDate, fmtDateTime, daysAgo, today, cleanParams } from '../lib/format';

function AssetFields({ base, setBase, form, setForm, excludeAmmo }) {
  const { isAdmin } = useAuth();
  const { data: assets } = useApi('/assets', { base, inStock: 'true' });
  const options = (assets || []).filter((a) => !excludeAmmo || a.assetType !== 'ammunition');
  const asset = options.find((a) => a._id === form.assetId);
  return (
    <>
      <Field label="Base">
        {isAdmin
          ? <select className="input" value={base} onChange={(e) => { setBase(e.target.value); setForm((f) => ({ ...f, assetId: '' })); }}>{BASES.map((b) => <option key={b}>{b}</option>)}</select>
          : <input className="input" value={base} disabled />}
      </Field>
      <Field label="Quantity *" hint={asset ? `${fmtNum(asset.quantity)} available` : undefined}>
        <input className="input" type="number" min="1" max={asset?.quantity} required value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
      </Field>
      <Field label="Asset *" className="full">
        <select className="input" required value={form.assetId} onChange={(e) => setForm((f) => ({ ...f, assetId: e.target.value }))}>
          <option value="">Select asset…</option>
          {options.map((a) => <option key={a._id} value={a._id}>{a.name} ({a.assetType}) — {fmtNum(a.quantity)} available</option>)}
        </select>
      </Field>
    </>
  );
}

function useSubmit(path, onDone) {
  const [saving, setSaving] = useState(false);
  const submit = async (body) => {
    setSaving(true);
    try {
      const res = await API.post(path, body);
      toast.success(res.data.message);
      onDone();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed');
      return false;
    } finally {
      setSaving(false);
    }
  };
  return [saving, submit];
}

function AssignForm({ open, onClose, onSaved }) {
  const { user } = useAuth();
  const [base, setBase] = useState(user.base);
  const empty = { assetId: '', quantity: '1', assignedTo: '', rank: '', serviceId: '', unit: '', purpose: '' };
  const [form, setForm] = useState(empty);
  const [saving, submit] = useSubmit('/assignments', () => { onSaved(); onClose(); setForm(empty); });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title="Assign to personnel" subtitle="Issued items leave available stock but remain base holdings until returned or expended."
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="assign-form" disabled={saving}>{saving ? <span className="spinner" /> : 'Assign'}</button></>}>
      <form id="assign-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submit({ ...form, quantity: Number(form.quantity) }); }}>
        <Field label="Rank"><input className="input" placeholder="Sgt." value={form.rank} onChange={set('rank')} /></Field>
        <Field label="Name *"><input className="input" required placeholder="Full name" value={form.assignedTo} onChange={set('assignedTo')} /></Field>
        <Field label="Service ID"><input className="input" placeholder="SVC-12345" value={form.serviceId} onChange={set('serviceId')} /></Field>
        <Field label="Unit"><input className="input" placeholder="1st Infantry Platoon" value={form.unit} onChange={set('unit')} /></Field>
        <AssetFields base={base} setBase={setBase} form={form} setForm={setForm} excludeAmmo={false} />
        <Field label="Purpose" className="full"><input className="input" placeholder="e.g. Border patrol rotation" value={form.purpose} onChange={set('purpose')} /></Field>
      </form>
    </Modal>
  );
}

function ExpendForm({ open, onClose, onSaved }) {
  const { user } = useAuth();
  const [base, setBase] = useState(user.base);
  const empty = { assetId: '', quantity: '', reason: 'training', notes: '' };
  const [form, setForm] = useState(empty);
  const [saving, submit] = useSubmit('/expenditures', () => { onSaved(); onClose(); setForm(empty); });

  return (
    <Modal open={open} onClose={onClose} title="Record expenditure" subtitle="Consumed, lost or written-off items are permanently removed from holdings."
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-danger" form="expend-form" disabled={saving}>{saving ? <span className="spinner" /> : 'Record expenditure'}</button></>}>
      <form id="expend-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); submit({ ...form, quantity: Number(form.quantity) }); }}>
        <AssetFields base={base} setBase={setBase} form={form} setForm={setForm} />
        <div className="field full">
          <span className="field-label">Reason</span>
          <div className="chip-group">
            {EXPENDITURE_REASONS.map((r) => (
              <button type="button" key={r} className={`chip ${form.reason === r ? 'active' : ''}`} style={{ textTransform: 'capitalize' }} onClick={() => setForm((f) => ({ ...f, reason: r }))}>{r}</button>
            ))}
          </div>
        </div>
        <Field label="Notes" className="full"><textarea className="input" rows={2} placeholder="e.g. Range qualification, 2nd platoon" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
      </form>
    </Modal>
  );
}

function CloseAssignment({ target, onClose, onSaved }) {
  const [reason, setReason] = useState('damaged');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const mode = target?.mode;
  const a = target?.assignment;

  const confirm = async () => {
    setSaving(true);
    try {
      const res = await API.put(`/assignments/${a._id}/${mode}`, mode === 'expend' ? { reason, notes } : {});
      toast.success(res.data.message);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!target} onClose={onClose} width={480}
      title={mode === 'expend' ? 'Mark assignment as expended' : 'Return to stock'}
      subtitle={a && `${fmtNum(a.quantity)} × ${a.assetName} · ${[a.rank, a.assignedTo].filter(Boolean).join(' ')}`}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className={`btn ${mode === 'expend' ? 'btn-danger' : 'btn-primary'}`} disabled={saving} onClick={confirm}>
          {saving ? <span className="spinner" /> : mode === 'expend' ? 'Mark expended' : 'Confirm return'}
        </button>
      </>}>
      {mode === 'expend' ? (
        <div className="stack" style={{ gap: 12 }}>
          <div className="chip-group">
            {EXPENDITURE_REASONS.map((r) => <button key={r} className={`chip ${reason === r ? 'active' : ''}`} style={{ textTransform: 'capitalize' }} onClick={() => setReason(r)}>{r}</button>)}
          </div>
          <textarea className="input" rows={2} placeholder="Circumstances (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      ) : (
        <p className="secondary">The items will be added back to available stock at {a?.base}.</p>
      )}
    </Modal>
  );
}

export default function Assignments() {
  const { user, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'expenditures' ? 'expenditures' : 'assignments';
  const [filters, setFilters] = useState({ from: daysAgo(89), to: today(), base: 'all', assetType: 'all', status: 'all', search: '' });
  const [modal, setModal] = useState(null);
  const [closing, setClosing] = useState(null);
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const common = { from: filters.from, to: filters.to, base: filters.base, assetType: filters.assetType };
  const asg = useApi('/assignments', cleanParams({ ...common, status: filters.status, search: filters.search }));
  const exp = useApi('/expenditures', cleanParams(common));
  const reloadAll = () => { asg.reload(); exp.reload(); };

  const stats = useMemo(() => {
    const a = asg.data || [];
    const e = exp.data || [];
    return {
      active: a.filter((x) => x.status === 'active').reduce((s, x) => s + x.quantity, 0),
      personnel: new Set(a.filter((x) => x.status === 'active').map((x) => x.assignedTo)).size,
      assigned: a.reduce((s, x) => s + x.quantity, 0),
      expended: e.reduce((s, x) => s + x.quantity, 0),
    };
  }, [asg.data, exp.data]);

  const asgColumns = [
    { key: 'assignedAt', header: 'Date', render: (a) => <span className="secondary">{fmtDate(a.assignedAt)}</span>, sort: (a) => new Date(a.assignedAt).getTime(), csv: (a) => fmtDateTime(a.assignedAt) },
    { key: 'assignedTo', header: 'Personnel', render: (a) => <div><div className="cell-title">{[a.rank, a.assignedTo].filter(Boolean).join(' ')}</div><div className="cell-sub">{[a.serviceId, a.unit].filter(Boolean).join(' · ')}</div></div>, sort: (a) => a.assignedTo, csv: (a) => `${a.rank || ''} ${a.assignedTo}`.trim() },
    { key: 'assetName', header: 'Asset', render: (a) => <div><div>{a.assetName}</div><TypeBadge type={a.assetType} /></div>, sort: (a) => a.assetName, csv: (a) => a.assetName },
    { key: 'base', header: 'Base', render: (a) => <span className="secondary">{a.base}</span>, sort: (a) => a.base, csv: (a) => a.base },
    { key: 'quantity', header: 'Qty', className: 'num', render: (a) => fmtNum(a.quantity), sort: (a) => a.quantity, csv: (a) => a.quantity },
    { key: 'purpose', header: 'Purpose', render: (a) => <span className="muted" style={{ fontSize: '.8rem' }}>{a.purpose || '—'}</span>, csv: (a) => a.purpose },
    { key: 'status', header: 'Status', render: (a) => <div><StatusBadge status={a.status} />{a.closedAt && <div className="cell-sub">{fmtDate(a.closedAt)}</div>}</div>, sort: (a) => a.status, csv: (a) => a.status },
    { key: 'actions', header: '', render: (a) => a.status === 'active' && (
      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setClosing({ mode: 'return', assignment: a })}><FiCornerUpLeft /> Return</button>
        <button className="btn btn-danger btn-sm" onClick={() => setClosing({ mode: 'expend', assignment: a })} title="Mark expended"><FiZap /></button>
      </div>
    ) },
  ];

  const expColumns = [
    { key: 'expendedAt', header: 'Date', render: (e) => <span className="secondary">{fmtDate(e.expendedAt)}</span>, sort: (e) => new Date(e.expendedAt).getTime(), csv: (e) => fmtDateTime(e.expendedAt) },
    { key: 'assetName', header: 'Asset', render: (e) => <div><div className="cell-title">{e.assetName}</div><TypeBadge type={e.assetType} /></div>, sort: (e) => e.assetName, csv: (e) => e.assetName },
    { key: 'base', header: 'Base', render: (e) => <span className="secondary">{e.base}</span>, sort: (e) => e.base, csv: (e) => e.base },
    { key: 'quantity', header: 'Qty', className: 'num', render: (e) => fmtNum(e.quantity), sort: (e) => e.quantity, csv: (e) => e.quantity },
    { key: 'reason', header: 'Reason', render: (e) => <Badge tone={e.reason === 'training' ? 'blue' : e.reason === 'combat' ? 'red' : 'slate'}>{e.reason}</Badge>, sort: (e) => e.reason, csv: (e) => e.reason },
    { key: 'source', header: 'Source', render: (e) => <span className="muted" style={{ fontSize: '.8rem' }}>{e.assignment ? 'From assignment' : 'Base stock'}</span>, csv: (e) => (e.assignment ? 'assignment' : 'stock') },
    { key: 'notes', header: 'Notes', render: (e) => <span className="muted" style={{ fontSize: '.8rem' }}>{e.notes || '—'}</span>, csv: (e) => e.notes },
    { key: 'by', header: 'Authorised by', render: (e) => <span className="muted">{e.expendedBy?.name}</span>, csv: (e) => e.expendedBy?.name },
  ];

  const switchTab = (t) => setParams(t === 'expenditures' ? { tab: t } : {});

  return (
    <div className="stack">
      <PageHeader eyebrow={isAdmin ? 'All bases' : user.base} title="Assignments & Expenditures" subtitle="Issue assets to personnel, process returns and account for everything expended.">
        <button className="btn btn-ghost" onClick={() => setModal('expend')}><FiZap /> Record expenditure</button>
        <button className="btn btn-primary" onClick={() => setModal('assign')}><FiUserPlus /> Assign asset</button>
      </PageHeader>

      <div className="grid-kpi">
        <Kpi label="Currently issued" value={fmtNum(stats.active)} icon={FiPackage} color={MOVE.assigned.color} foot="Active assignments in period" />
        <Kpi label="Personnel equipped" value={fmtNum(stats.personnel)} icon={FiUsers} color="var(--slate)" foot="With active assignments" delay={0.05} />
        <Kpi label="Assigned in period" value={fmtNum(stats.assigned)} icon={FiUserPlus} color={MOVE.transferIn.color} foot="All statuses" delay={0.1} />
        <Kpi label="Expended in period" value={fmtNum(stats.expended)} icon={FiZap} color={MOVE.expended.color} foot="Units written off" delay={0.15} />
      </div>

      <Card bodyClass="">
        <div className="tabs" style={{ padding: '0 .75rem' }}>
          {[['assignments', 'Assignments', asg.data?.length], ['expenditures', 'Expenditures', exp.data?.length]].map(([k, label, count]) => (
            <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => switchTab(k)}>
              {label} {count !== undefined && <span className="tab-count">{count}</span>}
              {tab === k && <span className="tab-indicator" />}
            </button>
          ))}
        </div>
        <div className="filter-bar" style={{ borderBottom: '1px solid var(--border)' }}>
          <Field label="Period"><DatePresets from={filters.from} to={filters.to} onChange={set} /></Field>
          <Field label="From"><input type="date" className="input" value={filters.from} max={today()} onChange={(e) => set({ from: e.target.value })} /></Field>
          <Field label="To"><input type="date" className="input" value={filters.to} max={today()} onChange={(e) => set({ to: e.target.value })} /></Field>
          <Field label="Base"><BaseSelect value={filters.base} onChange={(base) => set({ base })} isAdmin={isAdmin} userBase={user.base} /></Field>
          <Field label="Equipment type"><TypeSelect value={filters.assetType} onChange={(assetType) => set({ assetType })} /></Field>
          {tab === 'assignments' && <>
            <Field label="Status">
              <select className="input" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
                <option value="all">All statuses</option><option value="active">Active</option><option value="returned">Returned</option><option value="expended">Expended</option>
              </select>
            </Field>
            <Field label="Search" className="grow">
              <div style={{ position: 'relative' }}>
                <FiSearch style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                <input className="input" style={{ paddingLeft: 34 }} placeholder="Personnel or asset…" value={filters.search} onChange={(e) => set({ search: e.target.value })} />
              </div>
            </Field>
          </>}
        </div>
        {tab === 'assignments'
          ? <DataTable columns={asgColumns} rows={asg.data} loading={asg.loading} error={asg.error} exportName="assignments" emptyTitle="No assignments found" initialSort={{ key: 'assignedAt', dir: 'desc' }} />
          : <DataTable columns={expColumns} rows={exp.data} loading={exp.loading} error={exp.error} exportName="expenditures" emptyTitle="No expenditures found" initialSort={{ key: 'expendedAt', dir: 'desc' }} />}
      </Card>

      <AssignForm open={modal === 'assign'} onClose={() => setModal(null)} onSaved={reloadAll} />
      <ExpendForm open={modal === 'expend'} onClose={() => setModal(null)} onSaved={reloadAll} />
      <CloseAssignment target={closing} onClose={() => setClosing(null)} onSaved={reloadAll} />
    </div>
  );
}
