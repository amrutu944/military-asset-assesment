import { useMemo, useState } from 'react';
import { FiSearch, FiPackage } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi';
import { PageHeader, Card, DataTable, TypeBadge, Badge, Field, BaseSelect, TypeSelect } from '../components/ui.jsx';
import { ASSET_TYPES, TYPE_META } from '../lib/constants';
import { fmtNum, fmtMoney, fmtDate, cleanParams } from '../lib/format';

const levelOf = (a) => {
  const low = a.assetType === 'ammunition' ? 500 : 5;
  if (a.quantity === 0) return { tone: 'red', label: 'Out of stock' };
  if (a.quantity < low) return { tone: 'amber', label: 'Low' };
  return { tone: 'green', label: 'Healthy' };
};

export default function Inventory() {
  const { user, isAdmin } = useAuth();
  const [filters, setFilters] = useState({ base: 'all', assetType: 'all', search: '' });
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const { data, loading, error } = useApi('/assets', cleanParams(filters));

  const totals = useMemo(() => ASSET_TYPES.map((t) => {
    const rows = (data || []).filter((a) => a.assetType === t);
    return { type: t, qty: rows.reduce((s, a) => s + a.quantity, 0), lines: rows.length, value: rows.reduce((s, a) => s + a.quantity * (a.unitCost || 0), 0) };
  }), [data]);

  const columns = [
    { key: 'name', header: 'Asset', render: (a) => <div className="cell-title">{a.name}</div>, sort: (a) => a.name, csv: (a) => a.name },
    { key: 'assetType', header: 'Type', render: (a) => <TypeBadge type={a.assetType} />, sort: (a) => a.assetType, csv: (a) => a.assetType },
    { key: 'base', header: 'Base', render: (a) => <span className="secondary">{a.base}</span>, sort: (a) => a.base, csv: (a) => a.base },
    { key: 'quantity', header: 'On hand', className: 'num', render: (a) => <strong>{fmtNum(a.quantity)}</strong>, sort: (a) => a.quantity, csv: (a) => a.quantity },
    { key: 'unitCost', header: 'Unit cost', className: 'num', render: (a) => fmtMoney(a.unitCost), sort: (a) => a.unitCost, csv: (a) => a.unitCost },
    { key: 'value', header: 'Stock value', className: 'num', render: (a) => fmtMoney(a.quantity * a.unitCost), sort: (a) => a.quantity * a.unitCost, csv: (a) => a.quantity * a.unitCost },
    { key: 'level', header: 'Status', render: (a) => { const l = levelOf(a); return <Badge tone={l.tone} dot>{l.label}</Badge>; }, sort: (a) => a.quantity, csv: (a) => levelOf(a).label },
    { key: 'updatedAt', header: 'Last movement', render: (a) => <span className="muted">{fmtDate(a.updatedAt)}</span>, sort: (a) => new Date(a.updatedAt).getTime(), csv: (a) => fmtDate(a.updatedAt) },
  ];

  return (
    <div className="stack">
      <PageHeader eyebrow={isAdmin ? 'All bases' : user.base} title="Inventory" subtitle="Current on-hand stock per base. Quantities only change through recorded transactions." />

      <div className="grid-kpi">
        {totals.map((t) => {
          const M = TYPE_META[t.type];
          return (
            <button key={t.type} className={`card kpi clickable`} style={{ '--kpi-color': M.color, borderColor: filters.assetType === t.type ? 'var(--border-accent)' : undefined }}
              onClick={() => set({ assetType: filters.assetType === t.type ? 'all' : t.type })}>
              <span className="kpi-label"><span className="kpi-icon"><M.Icon size={13} /></span>{M.plural}</span>
              <span className="kpi-value">{fmtNum(t.qty)}</span>
              <span className="kpi-foot">{t.lines} line{t.lines === 1 ? '' : 's'} · {fmtMoney(t.value)}</span>
            </button>
          );
        })}
      </div>

      <Card bodyClass="">
        <div className="filter-bar" style={{ borderBottom: '1px solid var(--border)' }}>
          <Field label="Search" className="grow">
            <div style={{ position: 'relative' }}>
              <FiSearch style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input className="input" style={{ paddingLeft: 34 }} placeholder="Asset name…" value={filters.search} onChange={(e) => set({ search: e.target.value })} />
            </div>
          </Field>
          <Field label="Base"><BaseSelect value={filters.base} onChange={(base) => set({ base })} isAdmin={isAdmin} userBase={user.base} /></Field>
          <Field label="Equipment type"><TypeSelect value={filters.assetType} onChange={(assetType) => set({ assetType })} /></Field>
        </div>
        <DataTable columns={columns} rows={data} loading={loading} error={error} exportName="inventory" pageSize={15}
          emptyTitle="No assets match" emptyText={<><FiPackage /> Record a purchase to add stock.</>} initialSort={{ key: 'base', dir: 'asc' }} />
      </Card>
    </div>
  );
}
