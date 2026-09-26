import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { IS_DEMO } from './api/axios';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Inventory from './pages/Inventory.jsx';
import Purchases from './pages/Purchases.jsx';
import Transfers from './pages/Transfers.jsx';
import Assignments from './pages/Assignments.jsx';
import AuditLog from './pages/AuditLog.jsx';
import Users from './pages/Users.jsx';

// The demo build is served from a single static page, so it uses hash routing
const Router = IS_DEMO ? HashRouter : BrowserRouter;

function Guard({ section, children }) {
  const { isLoggedIn, can } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (section && !can(section)) return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <Navigate to="/dashboard" replace /> : children;
}

const PAGES = [
  ['dashboard', Dashboard],
  ['inventory', Inventory],
  ['purchases', Purchases],
  ['transfers', Transfers],
  ['assignments', Assignments],
  ['audit', AuditLog],
  ['users', Users],
];

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#141a24', color: '#e8edf4', border: '1px solid rgba(255,255,255,.12)',
              fontSize: '.86rem', borderRadius: 10,
            },
            success: { iconTheme: { primary: '#4ade80', secondary: '#0b0f15' } },
            error: { iconTheme: { primary: '#f87171', secondary: '#0b0f15' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route element={<Guard><Layout /></Guard>}>
            {PAGES.map(([section, Page]) => (
              <Route key={section} path={`/${section}`} element={<Guard section={section}><Page /></Guard>} />
            ))}
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
