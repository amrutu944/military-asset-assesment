import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiSearch, FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import API from '../api/axios';
import { useApi } from '../hooks/useApi';
import {
  PageHeader, Card, Kpi, Modal, DataTable, TypeBadge, Field, DatePresets, BaseSelect, TypeSelect,
} from '../components/ui.jsx';
import { BASES, ASSET_TYPES, TYPE_META } from '../lib/constants';
import { fmtNum, fmtMoney, fmtDate, daysAgo, today, cleanParams } from '../lib/format';
import { FiShoppingCart, FiDollarSign, FiFileText } from 'react-icons/fi';

function PurchaseForm({ open, onClose, onSaved }) {
  const { user, isAdmin } = useAuth();
  const empty = { assetName: '', assetType: 'weapon', base: user.base, quantity: '', unitCost: '', supplier: '', reference: '', purchaseDate: today(), notes: '' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const { data: existing } = useApi('/assets', { base: form.base });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await API.post('/purchases', { ...form, quantity: Number(form.quantity), unitCost: Number(form.unitCost) || 0 });
      toast.success(res.data.message);
      setForm(empty);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record purchase');
    } finally {
      setSaving(false);
    }
  };

  const total = (Number(form.quantity) || 0) * (Number(form.unitCost) || 0);
  const names = [...new Set((existing || []).filter((a) => a.assetType === form.assetType).map((a) => a.name))];

  return (
    <Modal open={open} onClose={onClose} title="Record purchase" subtitle="Adds stock to the selected base and writes an immutable ledger entry."
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} type="button">Cancel</button>
        <button className="btn btn-primary" form="purchase-form" type="submit" disabled={saving}>{saving ? <span className="spinner" /> : 'Confirm purchase'}</button>
      </>}>
      <form id="purchase-form" onSubmit={submit} className="form-grid">
        <div className="field full">
          <span className="field-label">Equipment type</span>
          <div className="chip-group">
            {ASSET_TYPES.map((t) => {
              const M = TYPE_META[t];
              return (
                <button key={t} type="button" className={`chip ${form.assetType === t ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, assetType: t }))}>
                  <M.Icon size={12} /> {M.label}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Asset name *" className="full" hint={names.length ? 'Pick an existing line to top it up, or type a new one.' : undefined}>
          <input className="input" list="asset-names" required placeholder="e.g. M4A1 Carbine" value={form.assetName} onChange={set('assetName')} />
          <datalist id="asset-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
        </Field>
        <Field label="Quantity *"><input className="input" type="number" min="1" step="1" required value={form.quantity} onChange={set('quantity')} /></Field>
        <Field label="Unit cost (USD)"><input className="input" type="number" min="0" step="0.01" value={form.unitCost} onChange={set('unitCost')} /></Field>
        <Field label="Base">
          {isAdmin
            ? <select className="input" value={form.base} onChange={set('base')}>{BASES.map((b) => <option key={b}>{b}</option>)}</select>
            : <input className="input" value={form.base} disabled />}
        </Field>
        <Field label="Purchase date"><input className="input" type="date" max={today()} value={form.purchaseDate} onChange={set('purchaseDate')} /></Field>
        <Field label="Supplier"><input className="input" placeholder="e.g. Defense Logistics Agency" value={form.supplier} onChange={set('supplier')} /></Field>
        <Field label="PO / reference"><input className="input" placeholder="PO-2026-1234" value={form.reference} onChange={set('reference')} /></Field>
        <Field label="Notes" className="full"><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} /></Field>
        {total > 0 && (
          <div className="formula full">Total value: <b>{fmtMoney(total)}</b></div>
        )}
      </form>
    </Modal>
  );
}

export default function Purchases() {
  const { user, isAdmin } = useAuth();
  const [filters, setFilters] = useState({ from: daysAgo(89), to: today(), base: 'all', assetType: 'all', search: '' });
  const [open, setOpen] = useState(false);
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const { data, meta, loading, error, reload } = useApi('/purchases', cleanParams(filters));

  const columns = [
    { key: 'purchaseDate', header: 'Date', render: (p) => <span className="secondary">{fmtDate(p.purchaseDate)}</span>, sort: (p) => new Date(p.purchaseDate).getTime(), csv: (p) => fmtDate(p.purchaseDate) },
    { key: 'assetName', header: 'Asset', render: (p) => <div><div className="cell-title">{p.assetName}</div><div className="cell-sub mono">{p.reference}</div></div>, sort: (p) => p.assetName, csv: (p) => p.assetName },
    { key: 'assetType', header: 'Type', render: (p) => <TypeBadge type={p.assetType} />, sort: (p) => p.assetType, csv: (p) => p.assetType },
    { key: 'base', header: 'Base', render: (p) => <span className="secondary">{p.base}</span>, sort: (p) => p.base, csv: (p) => p.base },
    { key: 'supplier', header: 'Supplier', render: (p) => <span className="secondary">{p.supplier || '—'}</span>, sort: (p) => p.supplier, csv: (p) => p.supplier },
    { key: 'quantity', header: 'Qty', className: 'num', render: (p) => fmtNum(p.quantity), sort: (p) => p.quantity, csv: (p) => p.quantity },
    { key: 'totalCost', header: 'Value', className: 'num', render: (p) => fmtMoney(p.totalCost), sort: (p) => p.totalCost, csv: (p) => p.totalCost },
    { key: 'by', header: 'Recorded by', render: (p) => <span className="muted">{p.purchasedBy?.name || '—'}</span>, csv: (p) => p.purchasedBy?.name },
  ];

  return (
    <div className="stack">
      <PageHeader eyebrow={isAdmin ? 'All bases' : user.base} title="Purchases" subtitle="Procurement history. Each purchase adds stock and is written to the audit trail.">
        <button className="btn btn-primary" onClick={() => setOpen(true)}><FiPlus /> Record purchase</button>
      </PageHeader>

      <div className="grid-kpi">
        <Kpi label="Purchase orders" value={fmtNum(meta.count || 0)} icon={FiFileText} color="var(--slate)" foot="In the selected period" />
        <Kpi label="Units purchased" value={fmtNum(meta.totals?.quantity || 0)} icon={FiShoppingCart} color="#16a34a" foot="All equipment types" delay={0.05} />
        <Kpi label="Procurement value" value={fmtMoney(meta.totals?.cost || 0)} icon={FiDollarSign} color="var(--accent)" foot="Quantity × unit cost" delay={0.1} />
      </div>

      <Card bodyClass="">
        <div className="filter-bar" style={{ borderBottom: '1px solid var(--border)' }}>
          <Field label="Period"><DatePresets from={filters.from} to={filters.to} onChange={set} /></Field>
          <Field label="From"><input type="date" className="input" value={filters.from} max={today()} onChange={(e) => set({ from: e.target.value })} /></Field>
          <Field label="To"><input type="date" className="input" value={filters.to} max={today()} onChange={(e) => set({ to: e.target.value })} /></Field>
          <Field label="Base"><BaseSelect value={filters.base} onChange={(base) => set({ base })} isAdmin={isAdmin} userBase={user.base} /></Field>
          <Field label="Equipment type"><TypeSelect value={filters.assetType} onChange={(assetType) => set({ assetType })} /></Field>
          <Field label="Search" className="grow">
            <div style={{ position: 'relative' }}>
              <FiSearch style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input className="input" style={{ paddingLeft: 34 }} placeholder="Asset name…" value={filters.search} onChange={(e) => set({ search: e.target.value })} />
            </div>
          </Field>
          {(filters.search || filters.assetType !== 'all' || filters.base !== 'all') && (
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 4 }} onClick={() => set({ search: '', assetType: 'all', base: 'all' })}><FiX /> Clear</button>
          )}
        </div>
        <DataTable columns={columns} rows={data} loading={loading} error={error} exportName="purchases"
          emptyTitle="No purchases found" emptyText="Adjust the filters or record a new purchase." initialSort={{ key: 'purchaseDate', dir: 'desc' }} />
      </Card>

      <PurchaseForm open={open} onClose={() => setOpen(false)} onSaved={reload} />
    </div>
  );
}
