import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FiMenu, FiMapPin } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_META } from '../lib/constants';
import { IS_DEMO } from '../api/axios';

const TITLES = {
  '/dashboard': 'Dashboard', '/inventory': 'Inventory', '/purchases': 'Purchases', '/transfers': 'Transfers',
  '/assignments': 'Assignments & Expenditures', '/audit': 'Audit Log', '/users': 'User Management',
};

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="mono muted navbar-clock" style={{ fontSize: '.74rem' }}>
      {now.toISOString().slice(0, 16).replace('T', ' ')} UTC
    </span>
  );
}

// Demo data lives in this browser; a second click within 4s confirms the reset
function DemoReset() {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const onClick = async () => {
    if (!armed) { setArmed(true); return; }
    (await import('../api/mock/server.js')).resetDemo();
    window.location.reload();
  };

  return (
    <button
      className="badge"
      style={{ '--b-color': 'var(--amber)', '--b-bg': 'var(--amber-bg)', '--b-border': 'var(--amber-border)', cursor: 'pointer' }}
      title="Demo mode: data is stored in this browser"
      onClick={onClick}
    >
      {armed ? 'Click again to reset data' : 'Demo · reset data'}
    </button>
  );
}

export default function Navbar({ collapsed, onMenu }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const role = ROLE_META[user?.role] || ROLE_META.logistics_officer;

  return (
    <header
      className="navbar"
      style={{
        position: 'fixed', top: 0, right: 0, left: collapsed ? 72 : 'var(--sidebar-w)', zIndex: 50,
        height: 'var(--navbar-h)', display: 'flex', alignItems: 'center', gap: '.8rem', padding: '0 1.5rem',
        background: 'rgba(11,15,21,.82)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)',
        transition: 'left .25s ease',
      }}
    >
      <style>{`
        @media (max-width: 900px) { .navbar { left: 0 !important; padding: 0 1rem !important; } .menu-btn { display: inline-flex !important; } }
        @media (max-width: 640px) { .navbar-clock, .navbar-user-text { display: none; } }
      `}</style>
      <button className="btn btn-ghost btn-icon menu-btn" style={{ display: 'none' }} onClick={onMenu} aria-label="Open menu"><FiMenu /></button>

      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {TITLES[pathname] || 'MilAsset'}
      </div>
      {IS_DEMO && <DemoReset />}

      <div className="spacer" />
      <Clock />

      <div className="row" style={{ gap: 10, padding: '.3rem .7rem .3rem .35rem', borderRadius: 99, border: '1px solid var(--border)', background: 'rgba(255,255,255,.02)' }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none',
          background: `color-mix(in srgb, ${role.color} 18%, transparent)`, color: role.color, fontWeight: 700, fontSize: '.8rem',
        }}>
          {user?.name?.replace(/^\S+\.\s*/, '').charAt(0)}
        </div>
        <div className="navbar-user-text" style={{ lineHeight: 1.2 }}>
          <div style={{ fontWeight: 600, fontSize: '.8rem', whiteSpace: 'nowrap' }}>{user?.name}</div>
          <div className="row" style={{ gap: 4, fontSize: '.68rem', color: role.color }}>
            {role.label} <span className="muted">·</span> <FiMapPin size={10} className="muted" /> <span className="muted">{user?.base}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
