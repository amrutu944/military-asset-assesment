import { useState } from 'react';
import { FiSearch, FiCheckCircle, FiXCircle, FiShield } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi';
import { PageHeader, Card, Modal, DataTable, Badge, Field, DatePresets, BaseSelect } from '../components/ui.jsx';
import { ROLE_META } from '../lib/constants';
import { fmtDateTime, daysAgo, today, cleanParams } from '../lib/format';

const ACTION_TONE = (a) => {
  if (a.startsWith('PURCHASE')) return 'green';
  if (a.startsWith('TRANSFER')) return 'blue';
  if (a.startsWith('ASSIGNMENT')) return 'violet';
  if (a.startsWith('EXPENDITURE')) return 'red';
  if (a.startsWith('LOGIN')) return 'slate';
  return 'amber';
};

export default function AuditLog() {
  const { user, isAdmin } = useAuth();
  const [filters, setFilters] = useState({ from: daysAgo(29), to: today(), base: 'all', action: 'all', success: 'all', search: '' });
  const [viewing, setViewing] = useState(null);
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const { data, meta, loading, error } = useApi('/audit', cleanParams({ ...filters, limit: 200 }));

  const columns = [
    { key: 'createdAt', header: 'Timestamp', render: (l) => <span className="mono secondary" style={{ fontSize: '.78rem' }}>{fmtDateTime(l.createdAt)}</span>, sort: (l) => new Date(l.createdAt).getTime(), csv: (l) => new Date(l.createdAt).toISOString() },
    { key: 'userName', header: 'User', render: (l) => <div><div className="cell-title" style={{ fontSize: '.84rem' }}>{l.userName}</div>{l.role && <div className="cell-sub" style={{ color: ROLE_META[l.role]?.color }}>{ROLE_META[l.role]?.label}</div>}</div>, sort: (l) => l.userName, csv: (l) => l.userName },
    { key: 'action', header: 'Action', render: (l) => <Badge tone={ACTION_TONE(l.action)}>{l.action.replace(/_/g, ' ').toLowerCase()}</Badge>, sort: (l) => l.action, csv: (l) => l.action },
    { key: 'summary', header: 'Details', render: (l) => <span style={{ fontSize: '.84rem' }}>{l.summary || <span className="muted mono">{l.method} {l.path}</span>}</span>, csv: (l) => l.summary },
    { key: 'base', header: 'Base', render: (l) => <span className="muted">{l.base || '—'}</span>, sort: (l) => l.base, csv: (l) => l.base },
    { key: 'success', header: 'Result', render: (l) => l.success
      ? <span className="row pos" style={{ gap: 4, fontSize: '.8rem' }}><FiCheckCircle /> {l.statusCode}</span>
      : <span className="row neg" style={{ gap: 4, fontSize: '.8rem' }}><FiXCircle /> {l.statusCode}</span>, sort: (l) => l.statusCode, csv: (l) => l.statusCode },
    { key: 'view', header: '', render: (l) => <button className="btn btn-ghost btn-sm" onClick={() => setViewing(l)}>Inspect</button> },
  ];

  return (
    <div className="stack">
      <PageHeader eyebrow={isAdmin ? 'All bases' : user.base} title="Audit log"
        subtitle="Every state-changing API call — successful or rejected — is recorded with who, what, when and from where." />

      <Card bodyClass="">
        <div className="filter-bar" style={{ borderBottom: '1px solid var(--border)' }}>
          <Field label="Period"><DatePresets from={filters.from} to={filters.to} onChange={set} /></Field>
          <Field label="From"><input type="date" className="input" value={filters.from} max={today()} onChange={(e) => set({ from: e.target.value })} /></Field>
          <Field label="To"><input type="date" className="input" value={filters.to} max={today()} onChange={(e) => set({ to: e.target.value })} /></Field>
          <Field label="Base"><BaseSelect value={filters.base} onChange={(base) => set({ base })} isAdmin={isAdmin} userBase={user.base} /></Field>
          <Field label="Action">
            <select className="input" value={filters.action} onChange={(e) => set({ action: e.target.value })}>
              <option value="all">All actions</option>
              {(meta.actions || []).map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ').toLowerCase()}</option>)}
            </select>
          </Field>
          <Field label="Result">
            <select className="input" value={filters.success} onChange={(e) => set({ success: e.target.value })}>
              <option value="all">All</option><option value="true">Succeeded</option><option value="false">Rejected / failed</option>
            </select>
          </Field>
          <Field label="Search" className="grow">
            <div style={{ position: 'relative' }}>
              <FiSearch style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input className="input" style={{ paddingLeft: 34 }} placeholder="User or details…" value={filters.search} onChange={(e) => set({ search: e.target.value })} />
            </div>
          </Field>
        </div>
        <DataTable columns={columns} rows={data} loading={loading} error={error} exportName="audit-log" pageSize={15}
          emptyTitle="No audit entries" footer={meta.total > (data?.length || 0) ? <span>showing latest {data?.length} of {meta.total.toLocaleString()}</span> : null}
          initialSort={{ key: 'createdAt', dir: 'desc' }} />
      </Card>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Audit entry" subtitle={viewing && fmtDateTime(viewing.createdAt)} width={600}>
        {viewing && (
          <div className="stack" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 8 }}><FiShield className="muted" /><Badge tone={ACTION_TONE(viewing.action)}>{viewing.action}</Badge>{!viewing.success && <Badge tone="red">rejected</Badge>}</div>
            <table className="table">
              <tbody>
                {[
                  ['User', `${viewing.userName}${viewing.role ? ` (${ROLE_META[viewing.role]?.label})` : ''}`],
                  ['Base', viewing.base || '—'],
                  ['Request', `${viewing.method} ${viewing.path}`],
                  ['Response', `${viewing.statusCode} · ${viewing.durationMs ?? '—'} ms`],
                  ['Entity', viewing.entity ? `${viewing.entity} #${viewing.entityId || '—'}` : '—'],
                  ['Client', `${viewing.ip || '—'} · ${viewing.userAgent || '—'}`],
                  ['Summary', viewing.summary || '—'],
                ].map(([k, v]) => (
                  <tr key={k}><td className="muted" style={{ width: 110 }}>{k}</td><td className="mono" style={{ fontSize: '.78rem', wordBreak: 'break-all' }}>{v}</td></tr>
                ))}
              </tbody>
            </table>
            {viewing.payload && (
              <div>
                <div className="field-label" style={{ marginBottom: 6 }}>Request payload (secrets redacted)</div>
                <pre className="mono" style={{ fontSize: '.74rem', padding: '.75rem', borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border)', overflowX: 'auto' }}>
                  {JSON.stringify(viewing.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
