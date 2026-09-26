import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiDownload, FiChevronUp, FiChevronDown, FiInbox } from 'react-icons/fi';
import { TYPE_META, BASES, ASSET_TYPES } from '../lib/constants';
import { DATE_PRESETS, daysAgo, today } from '../lib/format';
import { downloadCSV } from '../lib/csv';
import { IS_DEMO } from '../api/axios';

// ── Layout primitives ───────────────────────────────────────────────────────
export function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      <div className="spacer" />
      {children && <div className="row-wrap">{children}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className = '', bodyClass = 'card-body', style }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || actions) && (
        <header className="card-header">
          <div>
            <div className="card-title">{title}</div>
            {subtitle && <div className="card-sub">{subtitle}</div>}
          </div>
          <div className="spacer" />
          {actions}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, foot, color, icon: Icon, onClick, hint, delay = 0 }) {
  const Tag = onClick ? motion.button : motion.div;
  return (
    <Tag
      className={`card kpi ${onClick ? 'clickable' : ''}`}
      style={{ '--kpi-color': color }}
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      {hint && <span className="kpi-hint">{hint}</span>}
      <span className="kpi-label">
        {Icon && <span className="kpi-icon"><Icon size={14} /></span>}
        {label}
      </span>
      <span className="kpi-value">{value}</span>
      {foot && <span className="kpi-foot">{foot}</span>}
    </Tag>
  );
}

const TONES = {
  green: 'green', blue: 'blue', amber: 'amber', red: 'red', violet: 'violet', slate: 'slate', accent: 'accent',
};
export function Badge({ tone = 'slate', dot, children, title }) {
  const t = TONES[tone] || 'slate';
  const style = t === 'accent'
    ? { '--b-color': 'var(--accent)', '--b-bg': 'var(--accent-soft)', '--b-border': 'var(--border-accent)' }
    : { '--b-color': `var(--${t})`, '--b-bg': `var(--${t}-bg)`, '--b-border': `var(--${t}-border)` };
  return <span className={`badge ${dot ? 'badge-dot' : ''}`} style={style} title={title}>{children}</span>;
}

export function TypeBadge({ type }) {
  const m = TYPE_META[type];
  if (!m) return null;
  return (
    <span className="badge" style={{ '--b-color': m.color, '--b-bg': `${m.color}18`, '--b-border': `${m.color}40` }}>
      <m.Icon size={10} /> {m.label}
    </span>
  );
}

const STATUS_TONE = { pending: 'amber', approved: 'green', rejected: 'red', active: 'blue', returned: 'slate', expended: 'red' };
export const StatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status]} dot>{status}</Badge>;

export function Empty({ icon: Icon = FiInbox, title = 'Nothing here yet', children }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon /></div>
      <div className="secondary" style={{ fontWeight: 600 }}>{title}</div>
      {children && <div style={{ fontSize: '.8rem' }}>{children}</div>}
    </div>
  );
}

export const Skeleton = ({ height = 110, style }) => <div className="skeleton" style={{ height, ...style }} />;

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, subtitle, width = 560, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className="modal" role="dialog" aria-modal="true" style={{ maxWidth: width }}
            initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            <div className="modal-head">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="card-title" style={{ fontSize: '1.05rem' }}>{title}</div>
                {subtitle && <div className="card-sub" style={{ marginTop: 2 }}>{subtitle}</div>}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><FiX /></button>
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Data table with sorting, pagination and CSV export ──────────────────────
// columns: [{ key, header, render?, sort?: (row) => value, csv?: (row) => value, className? }]
export function DataTable({ columns, rows, loading, error, emptyTitle, emptyText, exportName, pageSize = 12, initialSort, footer }) {
  const [sort, setSort] = useState(initialSort || null);
  const [page, setPage] = useState(1);
  const [prevRows, setPrevRows] = useState(rows);

  // Back to the first page whenever the data set changes
  if (rows !== prevRows) {
    setPrevRows(rows);
    setPage(1);
  }

  const sorted = useMemo(() => {
    if (!rows || !sort) return rows || [];
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    return [...rows].sort((a, b) => {
      const va = col.sort(a); const vb = col.sort(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (col) => {
    if (!col.sort) return;
    setSort((s) => (s?.key === col.key ? { key: col.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: col.key, dir: 'desc' }));
  };

  if (loading) return <div style={{ padding: '1rem' }}><Skeleton height={220} /></div>;
  if (error) return <Empty title="Could not load data">{error}</Empty>;

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`${c.sort ? 'sortable' : ''} ${c.className || ''}`} onClick={() => toggleSort(c)}>
                  <span className="row" style={{ gap: 4, display: 'inline-flex', justifyContent: c.className === 'num' ? 'flex-end' : 'flex-start' }}>
                    {c.header}
                    {sort?.key === c.key && (sort.dir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={columns.length}><Empty title={emptyTitle}>{emptyText}</Empty></td></tr>
            ) : visible.map((row, i) => (
              <tr key={row._id || i}>
                {columns.map((c) => (
                  <td key={c.key} className={c.className}>{c.render ? c.render(row) : row[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <span>{sorted.length.toLocaleString()} record{sorted.length === 1 ? '' : 's'}</span>
        {footer}
        <div className="spacer" />
        {exportName && sorted.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => downloadCSV(exportName, sorted, columns.filter((c) => c.csv).map((c) => ({ header: c.header, csv: c.csv })))}>
            <FiDownload /> {IS_DEMO ? 'Copy as CSV' : 'Export CSV'}
          </button>
        )}
        {pages > 1 && (
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span className="mono">{page} / {pages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Filters ─────────────────────────────────────────────────────────────────
export function DatePresets({ from, to, onChange }) {
  const active = DATE_PRESETS.find((p) => (p.days === null ? !from : from === daysAgo(p.days - 1) && to === today()));
  return (
    <div className="chip-group">
      {DATE_PRESETS.map((p) => (
        <button
          key={p.label} type="button"
          className={`chip ${active === p ? 'active' : ''}`}
          onClick={() => onChange(p.days === null ? { from: '', to: '' } : { from: daysAgo(p.days - 1), to: today() })}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function BaseSelect({ value, onChange, isAdmin, userBase, allLabel = 'All bases' }) {
  if (!isAdmin) {
    return <select className="input" value={userBase} disabled><option>{userBase}</option></select>;
  }
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="all">{allLabel}</option>
      {BASES.map((b) => <option key={b} value={b}>{b}</option>)}
    </select>
  );
}

export function TypeSelect({ value, onChange }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="all">All equipment types</option>
      {ASSET_TYPES.map((t) => <option key={t} value={t}>{TYPE_META[t].plural}</option>)}
    </select>
  );
}
