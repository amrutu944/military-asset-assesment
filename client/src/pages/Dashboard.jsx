import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts';
import {
  FiArchive, FiTrendingUp, FiFlag, FiUserCheck, FiZap, FiRefreshCw, FiAlertTriangle, FiArrowRight, FiClock,
  FiShoppingCart, FiLogIn, FiLogOut, FiX,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import {
  PageHeader, Card, Kpi, Modal, DataTable, TypeBadge, Badge, Empty, Skeleton, Field, DatePresets, BaseSelect, TypeSelect,
} from '../components/ui.jsx';
import { MOVE, TYPE_META } from '../lib/constants';
import { fmtNum, fmtSigned, fmtDate, fmtDateTime, fmtMoney, fmtCompact, fmtRelative, daysAgo, today, cleanParams } from '../lib/format';

const GRID = 'rgba(255,255,255,0.05)';
const AXIS = { fill: '#6b7788', fontSize: 11 };

function ChartTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#10151d', border: '1px solid rgba(255,255,255,.14)', borderRadius: 10, padding: '.55rem .75rem', fontSize: '.78rem', boxShadow: 'var(--shadow-md)' }}>
      <div className="secondary" style={{ marginBottom: 4, fontWeight: 600 }}>{labelFormatter ? labelFormatter(label) : label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="row" style={{ gap: 8, justifyContent: 'space-between' }}>
          <span className="row" style={{ gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill }} />
            <span className="secondary">{p.name}</span>
          </span>
          <span className="mono" style={{ color: 'var(--text-primary)' }}>{fmtNum(Math.abs(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

const legendText = (v) => <span style={{ color: 'var(--text-secondary)', fontSize: '.76rem' }}>{v}</span>;

// ── Net movement drill-down (bonus requirement) ─────────────────────────────
function NetMovementModal({ open, onClose, summary }) {
  const [tab, setTab] = useState('purchases');
  if (!summary) return null;
  const { metrics, details, range, scope } = summary;

  const tabs = [
    { key: 'purchases', label: 'Purchases', Icon: FiShoppingCart, value: metrics.purchases, sign: '+', rows: details.purchases },
    { key: 'transferIn', label: 'Transfer In', Icon: FiLogIn, value: metrics.transferIn, sign: '+', rows: details.transferIn },
    { key: 'transferOut', label: 'Transfer Out', Icon: FiLogOut, value: metrics.transferOut, sign: '−', rows: details.transferOut },
  ];
  const current = tabs.find((t) => t.key === tab);

  const common = [
    { key: 'date', header: 'Date', render: (r) => <span className="secondary">{fmtDate(r.date)}</span>, sort: (r) => new Date(r.date).getTime(), csv: (r) => fmtDate(r.date) },
    { key: 'assetName', header: 'Asset', render: (r) => <div><div className="cell-title">{r.assetName}</div><TypeBadge type={r.assetType} /></div>, sort: (r) => r.assetName, csv: (r) => r.assetName },
  ];
  const columns = tab === 'purchases'
    ? [...common,
      { key: 'base', header: 'Base', csv: (r) => r.base, sort: (r) => r.base },
      { key: 'supplier', header: 'Supplier', render: (r) => <span className="secondary">{r.supplier || '—'}</span>, csv: (r) => r.supplier },
      { key: 'quantity', header: 'Qty', className: 'num', render: (r) => fmtNum(r.quantity), sort: (r) => r.quantity, csv: (r) => r.quantity },
      { key: 'totalCost', header: 'Value', className: 'num', render: (r) => fmtMoney(r.totalCost), sort: (r) => r.totalCost, csv: (r) => r.totalCost }]
    : [...common,
      { key: 'route', header: 'Route', render: (r) => <span className="secondary">{r.fromBase} <FiArrowRight size={11} /> {r.toBase}</span>, csv: (r) => `${r.fromBase} -> ${r.toBase}` },
      { key: 'by', header: 'Requested by', render: (r) => <span className="secondary">{r.by}</span>, csv: (r) => r.by },
      { key: 'quantity', header: 'Qty', className: 'num', render: (r) => fmtNum(r.quantity), sort: (r) => r.quantity, csv: (r) => r.quantity }];

  return (
    <Modal open={open} onClose={onClose} width={900}
      title="Net Movement breakdown"
      subtitle={`${scope.base} · ${scope.assetType === 'All Types' ? 'all equipment' : TYPE_META[scope.assetType].plural} · ${fmtDate(range.from)} → ${fmtDate(range.to)}`}>
      <div className="grid-kpi" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: '1rem' }}>
        {tabs.map((t) => (
          <button key={t.key} className={`card kpi clickable`} onClick={() => setTab(t.key)}
            style={{ '--kpi-color': MOVE[t.key].color, boxShadow: 'none', borderColor: tab === t.key ? 'var(--border-accent)' : undefined, background: tab === t.key ? 'var(--bg-card-hover)' : undefined }}>
            <span className="kpi-label"><span className="kpi-icon"><t.Icon size={13} /></span>{t.label}</span>
            <span className="kpi-value" style={{ fontSize: '1.5rem' }}>{t.sign}{fmtNum(t.value)}</span>
            <span className="kpi-foot">{t.rows.length} record{t.rows.length === 1 ? '' : 's'}</span>
          </button>
        ))}
      </div>
      <div className="formula" style={{ marginBottom: '1rem' }}>
        Net Movement = <b>{fmtNum(metrics.purchases)}</b> purchases + <b>{fmtNum(metrics.transferIn)}</b> in − <b>{fmtNum(metrics.transferOut)}</b> out =
        <b style={{ color: 'var(--accent)' }}>{fmtSigned(metrics.netMovement)}</b>
      </div>
      <div className="card" style={{ boxShadow: 'none' }}>
        <DataTable key={tab} columns={columns} rows={current.rows} pageSize={8} exportName={`net-movement-${tab}`}
          emptyTitle={`No ${current.label.toLowerCase()} in this period`} initialSort={{ key: 'date', dir: 'desc' }} />
      </div>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, isAdmin, can } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ from: daysAgo(29), to: today(), base: 'all', assetType: 'all' });
  const [showNet, setShowNet] = useState(false);
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const params = useMemo(() => cleanParams({ ...filters, from: filters.from || '2000-01-01' }), [filters]);
  const { data, loading, error, reload } = useApi('/dashboard/summary', params);

  const trend = useMemo(() => (data?.trend || []).map((b) => ({
    ...b,
    inflowP: b.purchases, inflowT: b.transferIn, outflowT: -b.transferOut, outflowE: -b.expended,
  })), [data]);

  const m = data?.metrics;
  const filtersActive = filters.base !== 'all' || filters.assetType !== 'all';

  return (
    <div className="stack">
      <PageHeader
        eyebrow={`${data?.scope.base || user.base} · ${fmtDate(data?.range.from || filters.from)} → ${fmtDate(data?.range.to || filters.to)}`}
        title="Operational overview"
        subtitle={`Welcome back, ${user.name}. Balances are computed live from the transaction ledger.`}
      >
        {data?.pendingTransfers > 0 && can('transfers') && (
          <Link to="/transfers" className="btn btn-ghost" style={{ textDecoration: 'none', color: 'var(--amber)', borderColor: 'var(--amber-border)' }}>
            <FiClock /> {data.pendingTransfers} pending transfer{data.pendingTransfers > 1 ? 's' : ''}
          </Link>
        )}
        <button className="btn btn-ghost" onClick={reload}><FiRefreshCw /> Refresh</button>
      </PageHeader>

      {/* Filters */}
      <div className="card filter-bar">
        <Field label="Period"><DatePresets from={filters.from} to={filters.to} onChange={set} /></Field>
        <Field label="From"><input type="date" className="input" value={filters.from} max={filters.to || today()} onChange={(e) => set({ from: e.target.value })} /></Field>
        <Field label="To"><input type="date" className="input" value={filters.to} min={filters.from} max={today()} onChange={(e) => set({ to: e.target.value })} /></Field>
        <Field label="Base"><BaseSelect value={filters.base} onChange={(base) => set({ base })} isAdmin={isAdmin} userBase={user.base} /></Field>
        <Field label="Equipment type"><TypeSelect value={filters.assetType} onChange={(assetType) => set({ assetType })} /></Field>
        {filtersActive && (
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 4 }} onClick={() => set({ base: 'all', assetType: 'all' })}><FiX /> Clear</button>
        )}
      </div>

      {error && <Card><Empty title="Could not load dashboard">{error}</Empty></Card>}

      {/* KPIs */}
      {loading && !data ? (
        <div className="grid-kpi">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />)}</div>
      ) : m && (
        <>
          <div className="grid-kpi" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
            <Kpi label="Opening Balance" value={fmtNum(m.openingBalance)} icon={FiArchive} color="var(--slate)" foot={`Holdings on ${fmtDate(data.range.from)}`} />
            <Kpi label="Net Movement" value={fmtSigned(m.netMovement)} icon={FiTrendingUp} color="var(--accent)" hint="Details ↗" delay={0.05}
              foot={`+${fmtCompact(m.purchases)} bought · +${fmtCompact(m.transferIn)} in · −${fmtCompact(m.transferOut)} out`}
              onClick={() => setShowNet(true)} />
            <Kpi label="Closing Balance" value={fmtNum(m.closingBalance)} icon={FiFlag} color={MOVE.balance.color} delay={0.1}
              foot={`${m.closingBalance >= m.openingBalance ? '▲' : '▼'} ${fmtNum(Math.abs(m.closingBalance - m.openingBalance))} vs opening`} />
            <Kpi label="Assigned" value={fmtNum(m.assigned)} icon={FiUserCheck} color={MOVE.assigned.color} delay={0.15}
              foot={`${fmtNum(data.activeAssignments)} currently issued to personnel`}
              onClick={can('assignments') ? () => navigate('/assignments') : undefined} />
            <Kpi label="Expended" value={fmtNum(m.expended)} icon={FiZap} color={MOVE.expended.color} delay={0.2}
              foot="Consumed, lost or written off"
              onClick={can('assignments') ? () => navigate('/assignments?tab=expenditures') : undefined} />
          </div>

          <div className="formula">
            Closing <b>{fmtNum(m.closingBalance)}</b> = Opening <b>{fmtNum(m.openingBalance)}</b> + Net Movement <b>{fmtSigned(m.netMovement)}</b> − Expended <b>{fmtNum(m.expended)}</b>
            <span className="muted" style={{ fontFamily: 'var(--font-main)' }}>· Assigned items remain base holdings until expended.</span>
          </div>

          {/* Charts */}
          <div className="grid-halves">
            <Card title="Holdings over time" subtitle="Running balance at the end of each period">
              <div style={{ height: 250 }}>
                <ResponsiveContainer>
                  <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={MOVE.balance.color} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={MOVE.balance.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(d) => fmtDate(d).slice(0, 6)} minTickGap={24} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={48} domain={['auto', 'auto']} />
                    <Tooltip content={<ChartTooltip labelFormatter={fmtDate} />} cursor={{ stroke: 'rgba(255,255,255,.2)' }} />
                    <Area type="monotone" dataKey="balance" name="Balance" stroke={MOVE.balance.color} strokeWidth={2} fill="url(#balFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: '#141a24' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Movements" subtitle="Inflows above the line, outflows below">
              <div style={{ height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={trend} stackOffset="sign" margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="18%">
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(d) => fmtDate(d).slice(0, 6)} minTickGap={24} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => fmtCompact(Math.abs(v))} width={48} />
                    <Tooltip content={<ChartTooltip labelFormatter={fmtDate} />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,.25)" />
                    <Legend iconType="square" iconSize={9} formatter={legendText} wrapperStyle={{ paddingTop: 6 }} />
                    <Bar dataKey="inflowP" name="Purchases" stackId="m" fill={MOVE.purchases.color} stroke="#141a24" strokeWidth={1} />
                    <Bar dataKey="inflowT" name="Transfer In" stackId="m" fill={MOVE.transferIn.color} stroke="#141a24" strokeWidth={1} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="outflowT" name="Transfer Out" stackId="m" fill={MOVE.transferOut.color} stroke="#141a24" strokeWidth={1} />
                    <Bar dataKey="outflowE" name="Expended" stackId="m" fill={MOVE.expended.color} stroke="#141a24" strokeWidth={1} radius={[0, 0, 3, 3]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Ledger by type */}
          <Card title="Balance ledger by equipment type" subtitle="How each closing balance is derived" bodyClass="">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th><th className="num">Opening</th><th className="num">+ Purchases</th><th className="num">+ Transfer in</th>
                    <th className="num">− Transfer out</th><th className="num">Net movement</th><th className="num">− Expended</th>
                    <th className="num">Closing</th><th className="num">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byType.map((r) => (
                    <tr key={r.assetType}>
                      <td><TypeBadge type={r.assetType} /></td>
                      <td className="num">{fmtNum(r.opening)}</td>
                      <td className="num">{fmtNum(r.purchases)}</td>
                      <td className="num">{fmtNum(r.transferIn)}</td>
                      <td className="num">{fmtNum(r.transferOut)}</td>
                      <td className={`num ${r.netMovement > 0 ? 'pos' : r.netMovement < 0 ? 'neg' : ''}`}>{fmtSigned(r.netMovement)}</td>
                      <td className="num">{fmtNum(r.expended)}</td>
                      <td className="num" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmtNum(r.closing)}</td>
                      <td className="num muted">{fmtNum(r.assigned)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid-2">
            <Card title="Holdings by base" subtitle="On hand vs. issued to personnel (current)">
              {data.byBase.length === 0 ? <Empty title="No holdings" /> : (
                <div style={{ height: Math.max(160, data.byBase.length * 58 + 40) }}>
                  <ResponsiveContainer>
                    <BarChart data={data.byBase} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap="28%">
                      <CartesianGrid stroke={GRID} horizontal={false} />
                      <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                      <YAxis type="category" dataKey="base" tick={{ ...AXIS, fill: '#a3afc0' }} tickLine={false} axisLine={false} width={92} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                      <Legend iconType="square" iconSize={9} formatter={legendText} />
                      <Bar dataKey="onHand" name="On hand" stackId="b" fill={MOVE.transferIn.color} stroke="#141a24" strokeWidth={2} />
                      <Bar dataKey="assigned" name="Assigned" stackId="b" fill={MOVE.assigned.color} stroke="#141a24" strokeWidth={2} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card title="Low stock alerts" subtitle="Below reorder threshold" bodyClass="card-body" actions={<Badge tone={data.lowStock.length ? 'red' : 'green'} dot>{data.lowStock.length}</Badge>}>
              {data.lowStock.length === 0 ? <Empty title="All stock levels healthy" /> : (
                <div className="stack" style={{ gap: 10 }}>
                  {data.lowStock.map((a) => (
                    <div key={a._id} className="row" style={{ gap: 10 }}>
                      <FiAlertTriangle style={{ color: a.quantity === 0 ? 'var(--red)' : 'var(--amber)', flex: 'none' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cell-title" style={{ fontSize: '.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                        <div className="cell-sub">{a.base}</div>
                      </div>
                      <span className="mono" style={{ fontWeight: 600 }}>{fmtNum(a.quantity)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {data.recentActivity.length > 0 && (
            <Card title="Recent activity" subtitle="Latest transactions from the audit trail"
              actions={can('audit') && <Link to="/audit" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>Full audit log <FiArrowRight /></Link>}>
              {data.recentActivity.map((a) => (
                <div key={a._id} className="activity-item">
                  <div className="activity-dot" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><FiClock /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.86rem' }}>{a.summary}</div>
                    <div className="cell-sub">{a.userName} · {a.action.replace(/_/g, ' ').toLowerCase()} · <span title={fmtDateTime(a.createdAt)}>{fmtRelative(a.createdAt)}</span></div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      <NetMovementModal open={showNet} onClose={() => setShowNet(false)} summary={data} />
    </div>
  );
}
