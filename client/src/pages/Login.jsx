import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowRight, FiLock, FiMail, FiShield, FiActivity, FiRepeat } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import API, { IS_DEMO } from '../api/axios';
import { DEMO_ACCOUNTS, ROLE_META } from '../lib/constants';

const FEATURES = [
  { Icon: FiActivity, title: 'Ledger-based balances', text: 'Opening, closing and net movement reproducible for any period.' },
  { Icon: FiRepeat, title: 'Controlled transfers', text: 'Maker–checker approval for inter-base movements.' },
  { Icon: FiShield, title: 'RBAC + full audit trail', text: 'Every transaction is attributed, timestamped and logged.' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverState, setServerState] = useState(IS_DEMO ? 'ready' : 'checking');

  // Free-tier hosts sleep when idle; ping early so the first login is not slow
  useEffect(() => {
    if (IS_DEMO) return;
    const slow = setTimeout(() => setServerState((s) => (s === 'checking' ? 'waking' : s)), 2500);
    API.get('/health').then(() => setServerState('ready')).catch(() => setServerState('waking'));
    return () => clearTimeout(slow);
  }, []);

  const submit = async (e, creds) => {
    e?.preventDefault();
    const payload = creds || { email, password };
    if (creds) { setEmail(creds.email); setPassword(creds.password); }
    setError('');
    setLoading(true);
    const result = await login(payload.email, payload.password);
    setLoading(false);
    if (result.success) navigate('/dashboard');
    else setError(result.message);
  };

  return (
    <div className="login-wrap">
      <style>{`
        .login-wrap { min-height: 100vh; display: grid; grid-template-columns: 1.1fr 1fr; }
        .login-hero { position: relative; overflow: hidden; padding: 3rem; display: flex; flex-direction: column; justify-content: space-between;
          border-right: 1px solid var(--border);
          background:
            linear-gradient(rgba(94,234,212,.05) 1px, transparent 1px) 0 0 / 40px 40px,
            linear-gradient(90deg, rgba(94,234,212,.05) 1px, transparent 1px) 0 0 / 40px 40px,
            radial-gradient(700px 400px at 20% 20%, rgba(94,234,212,.12), transparent 70%),
            var(--bg-sidebar); }
        .login-panel { display: flex; align-items: center; justify-content: center; padding: 2rem 1.25rem; }
        @media (max-width: 960px) { .login-wrap { grid-template-columns: 1fr; } .login-hero { display: none; } }
      `}</style>

      <aside className="login-hero">
        <div className="row" style={{ gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#5eead4,#3b82f6)', color: '#04201c', fontWeight: 800 }}>★</div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>MilAsset</div>
            <div className="mono muted" style={{ fontSize: '.62rem', letterSpacing: '.14em' }}>COMMAND · LOGISTICS</div>
          </div>
        </div>

        <div style={{ maxWidth: 520 }}>
          <div className="page-eyebrow" style={{ marginBottom: 12 }}>Military Asset Management System</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2rem, 3.2vw, 2.8rem)', lineHeight: 1.1, letterSpacing: '-.02em', fontWeight: 700 }}>
            Every vehicle, weapon and round —<span style={{ color: 'var(--accent)' }}> accounted for.</span>
          </h1>
          <p className="secondary" style={{ marginTop: 14, maxWidth: 440 }}>
            Track purchases, inter-base transfers, personnel assignments and expenditures across all bases with complete accountability.
          </p>
          <div className="stack" style={{ marginTop: 28, gap: 14 }}>
            {FEATURES.map(({ Icon, title, text }, i) => (
              <motion.div key={title} className="row" style={{ alignItems: 'flex-start', gap: 12 }}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1 }}>
                <div style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon /></div>
                <div>
                  <div style={{ fontWeight: 600 }}>{title}</div>
                  <div className="muted" style={{ fontSize: '.84rem' }}>{text}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mono muted" style={{ fontSize: '.68rem', letterSpacing: '.1em' }}>
          4 BASES · 4 EQUIPMENT CLASSES · 3 ROLES
        </div>
      </aside>

      <main className="login-panel">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: 410 }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 700 }}>Sign in</h2>
          <p className="muted" style={{ marginTop: 4, fontSize: '.88rem' }}>Access is restricted to authorised personnel.</p>

          {serverState !== 'ready' && (
            <div className="row" style={{ marginTop: 16, padding: '.55rem .8rem', borderRadius: 10, fontSize: '.78rem', background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid var(--amber-border)' }}>
              <span className="spinner" style={{ width: 13, height: 13 }} />
              {serverState === 'checking' ? 'Connecting to server…' : 'Server is waking up (free hosting) — this can take up to a minute.'}
            </div>
          )}

          <form onSubmit={submit} className="stack" style={{ gap: 14, marginTop: 22 }}>
            <label className="field">
              <span className="field-label">Email</span>
              <div style={{ position: 'relative' }}>
                <FiMail style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                <input className="input" style={{ paddingLeft: 36 }} type="email" autoComplete="username" placeholder="name@military.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <div style={{ position: 'relative' }}>
                <FiLock style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                <input className="input" style={{ paddingLeft: 36 }} type="password" autoComplete="current-password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </label>

            {error && <div style={{ fontSize: '.8rem', color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid var(--red-border)', padding: '.55rem .8rem', borderRadius: 10 }}>{error}</div>}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ minHeight: 44 }}>
              {loading ? <span className="spinner" /> : <>Sign in <FiArrowRight /></>}
            </button>
          </form>

          <div style={{ marginTop: 28 }}>
            <div className="row" style={{ gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span className="mono muted" style={{ fontSize: '.66rem', letterSpacing: '.14em' }}>DEMO ACCOUNTS — ONE CLICK</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {DEMO_ACCOUNTS.map((a) => {
                const meta = ROLE_META[a.role];
                return (
                  <button key={a.email} type="button" disabled={loading} onClick={() => submit(null, a)}
                    className="card row"
                    style={{ gap: 12, padding: '.7rem .85rem', cursor: 'pointer', textAlign: 'left', boxShadow: 'none', transition: 'border-color .15s, transform .15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flex: 'none' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: '.86rem', display: 'block' }}>{a.label}</span>
                      <span className="mono muted" style={{ fontSize: '.7rem' }}>{a.email}</span>
                    </span>
                    <span className="muted" style={{ fontSize: '.72rem', textAlign: 'right' }}>{a.note}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
