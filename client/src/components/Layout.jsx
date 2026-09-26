import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar.jsx';
import Navbar from './Navbar.jsx';
import { storage } from '../lib/storage';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(() => storage.get('sidebar') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const toggle = () => {
    setCollapsed((c) => {
      storage.set('sidebar', c ? 'open' : 'collapsed');
      return !c;
    });
  };

  return (
    <div className="app-shell">
      <Sidebar collapsed={collapsed} onToggle={toggle} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className={`app-main ${collapsed ? 'collapsed' : ''}`}>
        <Navbar collapsed={collapsed} onMenu={() => setMobileOpen(true)} />
        <motion.main
          key={location.pathname}
          className="app-content"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}
