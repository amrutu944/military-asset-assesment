import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiArrowRight, FiCheck, FiX, FiEye, FiClock, FiSend } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import API from '../api/axios';
import { useApi } from '../hooks/useApi';
import {
  PageHeader, Card, Modal, DataTable, TypeBadge, StatusBadge, Field, DatePresets, BaseSelect, TypeSelect,
} from '../components/ui.jsx';
import { BASES } from '../lib/constants';
import { fmtNum, fmtDate, fmtDateTime, daysAgo, today, cleanParams } from '../lib/format';

function TransferForm({ open, onClose, onSaved }) {
  const { user, isAdmin, isLogistics } = useAuth();
  const [fromBase, setFromBase] = useState(user.base);
  const [form, setForm] = useState({ assetId: '', toBase: '', quantity: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const { data: assets } = useApi('/assets', { base: fromBase, inStock: 'true' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const asset = (assets || []).find((a) => a._id === form.assetId);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await API.post('/transfers', { ...form, quantity: Number(form.quantity) });
      toast.success(res.data.message);
      setForm({ assetId: '', toBase: '', quantity: '', notes: '' });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transfer failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New transfer"
      subtitle={isLogistics ? 'Your request will be sent to the base commander for approval.' : 'Stock moves immediately and is recorded in the transfer history.'}
      footer={<>
        <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" form="transfer-form" disabled={saving}>
          {saving ? <span className="spinner" /> : isLogistics ? <><FiSend /> Submit request</> : <><FiArrowRight /> Transfer now</>}
        </button>
      </>}>
      <form id="transfer-form" onSubmit={submit} className="form-grid">
        <Field label="From base">
          {isAdmin
            ? <select className="input" value={fromBase} onChange={(e) => { setFromBase(e.target.value); setForm((f) => ({ ...f, assetId: '', toBase: '' })); }}>{BASES.map((b) => <option key={b}>{b}</option>)}</select>
            : <input className="input" value={fromBase} disabled />}
        </Field>
        <Field label="To base *">
          <select className="input" required value={form.toBase} onChange={set('toBase')}>
            <option value="">Select destination…</option>
            {BASES.filter((b) => b !== fromBase).map((b) => <option key={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Asset *" className="full">
          <select className="input" required value={form.assetId} onChange={set('assetId')}>
            <option value="">Select asset…</option>
            {(assets || []).map((a) => <option key={a._id} value={a._id}>{a.name} — {fmtNum(a.quantity)} available</option>)}
          </select>
        </Field>
        <Field label="Quantity *" hint={asset ? `Max ${fmtNum(asset.quantity)}` : undefined}>
          <input className="input" type="number" min="1" max={asset?.quantity} required value={form.quantity} onChange={set('quantity')} />
        </Field>
        <Field label="Reason / notes"><input className="input" placeholder="e.g. Joint exercise support" value={form.notes} onChange={set('notes')} /></Field>
        {asset && form.toBase && Number(form.quantity) > 0 && (
          <div className="formula full">
            <b>{fmtNum(form.quantity)}</b> × {asset.name}: <b>{fromBase}</b> <FiArrowRight /> <b>{form.toBase}</b>
          </div>
        )}
      </form>
    </Modal>
  );
}

function Timeline({ t }) {
  const steps = [
    { label: 'Requested', when: t.createdAt, who: t.transferredBy?.name, note: t.notes, color: 'var(--blue)' },
    t.status !== 'pending'
      ? { label: t.status === 'approved' ? 'Approved · stock moved' : 'Rejected', when: t.approvedAt, who: t.approvedBy?.name, note: t.decisionNote, color: t.status === 'approved' ? 'var(--green)' : 'var(--red)' }
      : { label: 'Awaiting approval', who: `${t.fromBase} commander`, color: 'var(--amber)', pending: true },
  ];
  return (
    <div className="stack" style={{ gap: 0 }}>
      {steps.map((s, i) => (
        <div key={s.label} className="row" style={{ alignItems: 'stretch', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', marginTop: 4, background: s.pending ? 'transparent' : s.color, border: `2px solid ${s.color}` }} />
            {i < steps.length - 1 && <span style={{ flex: 1, width: 2, background: 'var(--border-hover)', margin: '4px 0' }} />}
          </div>
          <div style={{ paddingBottom: 18 }}>
            <div style={{ fontWeight: 600 }}>{s.label}</div>
            <div className="cell-sub">{[s.who, s.when && fmtDateTime(s.when)].filter(Boolean).join(' · ')}</div>
            {s.note && <div className="secondary" style={{ fontSize: '.82rem', marginTop: 2 }}>“{s.note}”</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Transfers() {
  const { user, isAdmin, isLogistics } = useAuth();
  const [filters, setFilters] = useState({ from: daysAgo(89), to: today(), base: 'all', assetType: 'all' });
  const [tab, setTab] = useState('all');
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(null);
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const { data, loading, error, reload } = useApi('/transfers', cleanParams(filters));

  const focusBase = isAdmin ? (filters.base === 'all' ? null : filters.base) : user.base;
  const rows = useMemo(() => (data || []).filter((t) => {
    if (tab === 'pending') return t.status === 'pending';
    if (tab === 'in') return focusBase ? t.toBase === focusBase : true;
    if (tab === 'out') return focusBase ? t.fromBase === focusBase : true;
    return true;
  }), [data, tab, focusBase]);
  const pendingCount = (data || []).filter((t) => t.status === 'pending').length;

  const canDecide = (t) => t.status === 'pending' && !isLogistics && (isAdmin || t.fromBase === user.base);

  const decide = async (t, approve) => {
    setBusy(t._id);
    try {
      const res = await API.put(`/transfers/${t._id}/${approve ? 'approve' : 'reject'}`);
      toast.success(res.data.message);
      setViewing(null);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const columns = [
    { key: 'createdAt', header: 'Requested', render: (t) => <div><div className="secondary">{fmtDate(t.createdAt)}</div><div className="cell-sub">{new Date(t.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div></div>, sort: (t) => new Date(t.createdAt).getTime(), csv: (t) => fmtDateTime(t.createdAt) },
    { key: 'assetName', header: 'Asset', render: (t) => <div><div className="cell-title">{t.assetName}</div><TypeBadge type={t.assetType} /></div>, sort: (t) => t.assetName, csv: (t) => t.assetName },
    { key: 'route', header: 'Route', render: (t) => (
      <span className="row" style={{ gap: 6, whiteSpace: 'nowrap' }}>
        <span style={{ color: t.fromBase === focusBase ? 'var(--amber)' : 'var(--text-secondary)' }}>{t.fromBase}</span>
        <FiArrowRight className="muted" />
        <span style={{ color: t.toBase === focusBase ? 'var(--blue)' : 'var(--text-secondary)' }}>{t.toBase}</span>
      </span>
    ), sort: (t) => t.fromBase, csv: (t) => `${t.fromBase} -> ${t.toBase}` },
    { key: 'quantity', header: 'Qty', className: 'num', render: (t) => fmtNum(t.quantity), sort: (t) => t.quantity, csv: (t) => t.quantity },
    { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} />, sort: (t) => t.status, csv: (t) => t.status },
    { key: 'by', header: 'By', render: (t) => <div className="cell-sub">{t.transferredBy?.name}{t.approvedBy && t.approvedBy._id !== t.transferredBy?._id ? <><br />✓ {t.approvedBy.name}</> : null}</div>, csv: (t) => t.transferredBy?.name },
    { key: 'actions', header: '', render: (t) => (
      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
        {canDecide(t) && <>
          <button className="btn btn-success btn-sm" disabled={busy === t._id} onClick={() => decide(t, true)} title="Approve"><FiCheck /></button>
          <button className="btn btn-danger btn-sm" disabled={busy === t._id} onClick={() => decide(t, false)} title="Reject"><FiX /></button>
        </>}
        <button className="btn btn-ghost btn-sm" onClick={() => setViewing(t)} title="View history"><FiEye /></button>
      </div>
    ) },
  ];

  const TABS = [
    { key: 'all', label: 'All transfers' },
    { key: 'pending', label: 'Pending approval', count: pendingCount },
    { key: 'in', label: 'Incoming' },
    { key: 'out', label: 'Outgoing' },
  ];

  return (
    <div className="stack">
      <PageHeader eyebrow={isAdmin ? 'All bases' : user.base} title="Transfers"
        subtitle={isLogistics ? 'Raise transfer requests for your base; the base commander approves them.' : 'Move assets between bases with a complete, timestamped movement history.'}>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><FiPlus /> New transfer</button>
      </PageHeader>

      <Card bodyClass="">
        <div className="tabs" style={{ padding: '0 .75rem' }}>
          {TABS.map((t) => (
            <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.key === 'pending' && <FiClock />} {t.label}
              {t.count > 0 && <span className="tab-count" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>{t.count}</span>}
              {tab === t.key && <span className="tab-indicator" />}
            </button>
          ))}
        </div>
        <div className="filter-bar" style={{ borderBottom: '1px solid var(--border)' }}>
          <Field label="Period"><DatePresets from={filters.from} to={filters.to} onChange={set} /></Field>
          <Field label="From"><input type="date" className="input" value={filters.from} max={today()} onChange={(e) => set({ from: e.target.value })} /></Field>
          <Field label="To"><input type="date" className="input" value={filters.to} max={today()} onChange={(e) => set({ to: e.target.value })} /></Field>
          <Field label="Base"><BaseSelect value={filters.base} onChange={(base) => set({ base })} isAdmin={isAdmin} userBase={user.base} /></Field>
          <Field label="Equipment type"><TypeSelect value={filters.assetType} onChange={(assetType) => set({ assetType })} /></Field>
        </div>
        <DataTable columns={columns} rows={rows} loading={loading} error={error} exportName="transfers"
          emptyTitle="No transfers found" initialSort={{ key: 'createdAt', dir: 'desc' }} />
      </Card>

      <TransferForm open={open} onClose={() => setOpen(false)} onSaved={reload} />

      <Modal open={!!viewing} onClose={() => setViewing(null)} width={520} title="Transfer history"
        subtitle={viewing && `${fmtNum(viewing.quantity)} × ${viewing.assetName} · ${viewing.fromBase} → ${viewing.toBase}`}
        footer={viewing && canDecide(viewing) && <>
          <button className="btn btn-danger" disabled={busy} onClick={() => decide(viewing, false)}><FiX /> Reject</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => decide(viewing, true)}><FiCheck /> Approve & move stock</button>
        </>}>
        {viewing && <>
          <div className="row" style={{ gap: 8, marginBottom: 16 }}><StatusBadge status={viewing.status} /><TypeBadge type={viewing.assetType} /><span className="mono muted" style={{ fontSize: '.72rem' }}>#{String(viewing._id).slice(-8)}</span></div>
          <Timeline t={viewing} />
        </>}
      </Modal>
    </div>
  );
}
