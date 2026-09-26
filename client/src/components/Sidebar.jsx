import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiGrid, FiPackage, FiShoppingCart, FiRepeat, FiUserCheck, FiShield, FiUsers, FiLogOut, FiChevronsLeft, FiChevronsRight, FiX,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_META } from '../lib/constants';

const NAV = [
  { section: 'dashboard',   path: '/dashboard',   label: 'Dashboard',        Icon: FiGrid },
  { section: 'inventory',   path: '/inventory',   label: 'Inventory',        Icon: FiPackage },
  { section: 'purchases',   path: '/purchases',   label: 'Purchases',        Icon: FiShoppingCart },
  { section: 'transfers',   path: '/transfers',   label: 'Transfers',        Icon: FiRepeat },
  { section: 'assignments', path: '/assignments', label: 'Assign & Expend',  Icon: FiUserCheck },
  { section: 'audit',       path: '/audit',       label: 'Audit Log',        Icon: FiShield },
  { section: 'users',       path: '/users',       label: 'Users',            Icon: FiUsers },
];

function Logo({ collapsed }) {
  return (
    <div className="row" style={{ gap: 10, minWidth: 0 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, flex: 'none', display: 'grid', placeItems: 'center',
        background: 'linear-gradient(135deg, #5eead4, #3b82f6)', color: '#04201c', fontWeight: 800, fontFamily: 'var(--font-heading)',
      }}>
        ★
      </div>
      {!collapsed && (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', lineHeight: 1.1 }}>MilAsset</div>
          <div className="mono muted" style={{ fontSize: '.62rem', letterSpacing: '.14em' }}>COMMAND · LOGISTICS</div>
        </div>
      )}
    </div>
  );
}

function SidebarContent({ collapsed, onNavigate, onToggle, onClose }) {
  const { user, logout, can } = useAuth();
  const role = ROLE_META[user?.role] || ROLE_META.logistics_officer;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}>
      <div className="row" style={{ height: 'var(--navbar-h)', padding: collapsed ? '0 19px' : '0 1.1rem', borderBottom: '1px solid var(--border)' }}>
        <Logo collapsed={collapsed} />
        <div className="spacer" />
        {onClose && <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close menu"><FiX /></button>}
      </div>

      <nav style={{ flex: 1, padding: '.8rem .6rem', overflowY: 'auto' }}>
        {!collapsed && <div className="mono muted" style={{ fontSize: '.62rem', letterSpacing: '.14em', padding: '.3rem .7rem .5rem' }}>OPERATIONS</div>}
        {NAV.filter((n) => can(n.section)).map(({ path, label, Icon }) => (
          <NavLink key={path} to={path} onClick={onNavigate} title={collapsed ? label : undefined} style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}>
            {({ isActive }) => (
              <div
                className="row"
                style={{
                  position: 'relative', gap: 11, padding: collapsed ? '.62rem 0' : '.58rem .75rem',
                  justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 9,
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--accent-soft)' : 'transparent',
                  fontWeight: isActive ? 600 : 500, fontSize: '.88rem', transition: 'background .15s, color .15s',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {isActive && <motion.span layoutId="nav-active" style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 3, background: 'var(--accent)' }} />}
                <Icon size={17} style={{ flex: 'none' }} />
                {!collapsed && <span>{label}</span>}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '.7rem .6rem', borderTop: '1px solid var(--border)' }}>
        {!collapsed && (
          <div style={{ padding: '.7rem .75rem', borderRadius: 10, background: 'rgba(255,255,255,.025)', border: '1px solid var(--border)', marginBottom: 6 }}>
            <div className="cell-title" style={{ fontSize: '.85rem' }}>{user?.name}</div>
            <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span className="badge" style={{ '--b-color': role.color, '--b-bg': 'transparent', '--b-border': 'var(--border-hover)' }}>{role.label}</span>
              <span className="muted" style={{ fontSize: '.72rem' }}>{user?.base}</span>
            </div>
          </div>
        )}
        <div className="row" style={{ gap: 4, flexDirection: collapsed ? 'column' : 'row' }}>
          <button className="btn btn-ghost" style={{ flex: 1, width: collapsed ? 44 : undefined, border: 'none' }} onClick={logout} title="Sign out">
            <FiLogOut /> {!collapsed && 'Sign out'}
          </button>
          {onToggle && (
            <button className="btn btn-ghost btn-icon" style={{ border: 'none' }} onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
              {collapsed ? <FiChevronsRight /> : <FiChevronsLeft />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  return (
    <>
      <aside className="desktop-sidebar" style={{ width: collapsed ? 72 : 'var(--sidebar-w)', position: 'fixed', inset: '0 auto 0 0', zIndex: 60, transition: 'width .25s ease' }}>
        <SidebarContent collapsed={collapsed} onToggle={onToggle} />
      </aside>
      <style>{'@media (max-width: 900px) { .desktop-sidebar { display: none; } }'}</style>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onMobileClose}
            style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(3,6,10,.7)' }}
          >
            <motion.div
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: 272, maxWidth: '85vw', height: '100%' }}
            >
              <SidebarContent collapsed={false} onNavigate={onMobileClose} onClose={onMobileClose} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
