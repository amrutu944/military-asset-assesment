/*
 * In-browser implementation of the REST API, used only by the static demo build
 * (VITE_DEMO=true). It mirrors the Express routes in /server: same endpoints,
 * same RBAC rules, same stock/ledger maths and same audit logging, with state
 * kept in localStorage instead of MongoDB.
 */
import { generate, BASES, ASSET_TYPES, REASONS } from './seed.js';

const STORE_KEY = 'milasset-demo-v1';
const DAY = 864e5;

let db = null;
const load = () => {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { db = null; }
  if (!db?.users) db = generate();
  return db;
};
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch { /* storage full or blocked */ } };

let seq = 0;
const newId = () => (Date.now().toString(16) + (seq++).toString(16).padStart(4, '0') + Math.random().toString(16).slice(2, 8)).slice(0, 24);

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

// ── Helpers mirroring the server ─────────────────────────────────────────────
const userRef = (id) => { const u = db.users.find((x) => x._id === id); return u ? { _id: u._id, name: u.name, role: u.role } : null; };
const scopedBase = (user, q) => (user.role !== 'admin' ? user.base : BASES.includes(q.base) ? q.base : null);
const canAccessBase = (user, base) => user.role === 'admin' || user.base === base;
const authorize = (user, ...roles) => { if (!roles.includes(user.role)) throw new HttpError(403, `Role '${user.role}' is not authorized to perform this action`); };
const positiveInt = (v) => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'Quantity must be a positive whole number'); return n; };
const startOfDay = (d) => { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setUTCHours(23, 59, 59, 999); return x; };
const inRange = (value, q) => {
  if (!value) return false;
  const t = new Date(value).getTime();
  if (q.from && t < startOfDay(q.from).getTime()) return false;
  if (q.to && t > endOfDay(q.to).getTime()) return false;
  return true;
};
const matches = (text, s) => !s || String(text || '').toLowerCase().includes(String(s).toLowerCase());
const byDateDesc = (field) => (a, b) => new Date(b[field]) - new Date(a[field]);

const takeStock = (assetId, qty) => {
  const a = db.assets.find((x) => x._id === assetId);
  if (!a || a.quantity < qty) return null;
  a.quantity -= qty; a.updatedAt = new Date().toISOString();
  return a;
};
const addStock = ({ name, assetType, base, quantity, unitCost, userId }) => {
  let a = db.assets.find((x) => x.name === name && x.assetType === assetType && x.base === base);
  const now = new Date().toISOString();
  if (!a) {
    a = { _id: newId(), name, assetType, base, quantity: 0, unitCost: unitCost || 0, description: '', purchasedBy: userId, isActive: true, createdAt: now };
    db.assets.push(a);
  }
  a.quantity += quantity; a.updatedAt = now;
  if (unitCost) a.unitCost = unitCost;
  return a;
};

const popTransfer = (t) => ({ ...t, transferredBy: userRef(t.transferredBy), approvedBy: t.approvedBy ? userRef(t.approvedBy) : null });

// ── Routes ───────────────────────────────────────────────────────────────────
const routes = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler });
};

route('GET', '/health', () => ({ success: true, status: 'ok' }));

route('POST', '/auth/login', ({ body, res }) => {
  const u = db.users.find((x) => x.email === String(body.email || '').toLowerCase());
  if (!u || !u.isActive || u.password !== body.password) {
    res.audit = { action: 'LOGIN_FAILED', entity: 'User', summary: `Failed login for ${body.email}` };
    throw new HttpError(401, 'Invalid email or password');
  }
  res.audit = { action: 'LOGIN', entity: 'User', entityId: u._id, user: u, summary: `${u.name} signed in` };
  return { success: true, token: `demo.${u._id}`, user: { id: u._id, name: u.name, email: u.email, role: u.role, base: u.base } };
});

route('GET', '/auth/me', ({ user }) => ({ success: true, data: { id: user._id, name: user.name, email: user.email, role: user.role, base: user.base } }));

// Users (admin)
route('GET', '/users', ({ user }) => {
  authorize(user, 'admin');
  const data = db.users.map(({ password, ...u }) => u).sort((a, b) => a.role.localeCompare(b.role) || a.base.localeCompare(b.base));
  return { success: true, count: data.length, data };
});
route('POST', '/users', ({ user, body, res }) => {
  authorize(user, 'admin');
  const { name, email, password, role, base } = body;
  if (!name || !email || !password || password.length < 6) throw new HttpError(400, 'Name, email and a password of at least 6 characters are required');
  if (db.users.some((u) => u.email === email.toLowerCase())) throw new HttpError(400, 'A user with this email already exists');
  const u = { _id: newId(), name, email: email.toLowerCase(), password, role, base, isActive: true, createdAt: new Date().toISOString() };
  db.users.push(u);
  res.audit = { action: 'USER_CREATE', entity: 'User', entityId: u._id, base, summary: `Created ${role} ${name} (${base})` };
  return { status: 201, success: true, message: 'User created', data: u };
});
route('PUT', '/users/:id', ({ user, body, params, res }) => {
  authorize(user, 'admin');
  const u = db.users.find((x) => x._id === params.id);
  if (!u) throw new HttpError(404, 'User not found');
  if (u._id === user._id && (body.isActive === false || (body.role && body.role !== 'admin'))) throw new HttpError(400, 'You cannot deactivate or demote your own account');
  if (body.role !== undefined) u.role = body.role;
  if (body.base !== undefined) u.base = body.base;
  if (body.isActive !== undefined) u.isActive = !!body.isActive;
  res.audit = { action: 'USER_UPDATE', entity: 'User', entityId: u._id, base: u.base, summary: `Updated ${u.name}: ${u.role}, ${u.base}, ${u.isActive ? 'active' : 'deactivated'}` };
  return { success: true, message: 'User updated', data: u };
});

// Assets
route('GET', '/assets', ({ user, query }) => {
  const base = scopedBase(user, query);
  const data = db.assets.filter((a) => a.isActive
    && (!base || a.base === base)
    && (!ASSET_TYPES.includes(query.assetType) || a.assetType === query.assetType)
    && (query.inStock !== 'true' || a.quantity > 0)
    && matches(a.name, query.search))
    .sort((a, b) => a.base.localeCompare(b.base) || a.assetType.localeCompare(b.assetType) || a.name.localeCompare(b.name));
  return { success: true, count: data.length, data };
});

// Purchases
route('GET', '/purchases', ({ user, query }) => {
  const base = scopedBase(user, query);
  const data = db.purchases.filter((p) => (!base || p.base === base)
    && (!ASSET_TYPES.includes(query.assetType) || p.assetType === query.assetType)
    && (!query.from && !query.to ? true : inRange(p.purchaseDate, query))
    && matches(p.assetName, query.search))
    .sort(byDateDesc('purchaseDate'))
    .map((p) => ({ ...p, purchasedBy: userRef(p.purchasedBy) }));
  const totals = data.reduce((acc, p) => ({ quantity: acc.quantity + p.quantity, cost: acc.cost + (p.totalCost || 0) }), { quantity: 0, cost: 0 });
  return { success: true, count: data.length, totals, data };
});
route('POST', '/purchases', ({ user, body, res }) => {
  const quantity = positiveInt(body.quantity);
  const name = (body.assetName || '').trim();
  if (!name) throw new HttpError(400, 'Asset name is required');
  if (!ASSET_TYPES.includes(body.assetType)) throw new HttpError(400, 'Invalid asset type');
  if (!BASES.includes(body.base)) throw new HttpError(400, 'Invalid base');
  if (!canAccessBase(user, body.base)) throw new HttpError(403, 'You can only record purchases for your own base');
  const date = body.purchaseDate ? new Date(body.purchaseDate) : new Date();
  if (Number.isNaN(date.getTime()) || date > new Date()) throw new HttpError(400, 'Purchase date cannot be in the future');
  // A same-day date picked in the form means "now"
  const when = body.purchaseDate === new Date().toISOString().slice(0, 10) ? new Date() : date;
  const unitCost = Math.max(0, Number(body.unitCost) || 0);
  const asset = addStock({ name, assetType: body.assetType, base: body.base, quantity, unitCost, userId: user._id });
  const p = {
    _id: newId(), asset: asset._id, assetName: name, assetType: body.assetType, base: body.base, quantity, unitCost,
    totalCost: unitCost * quantity, supplier: body.supplier || '', reference: body.reference || '', notes: body.notes || '',
    purchaseDate: when.toISOString(), purchasedBy: user._id, createdAt: new Date().toISOString(),
  };
  db.purchases.push(p);
  res.audit = { action: 'PURCHASE_CREATE', entity: 'Purchase', entityId: p._id, base: p.base, summary: `Purchased ${quantity} × ${name} (${p.assetType}) for ${p.base}` };
  return { status: 201, success: true, message: `${quantity} × ${name} added to ${p.base}`, data: { ...p, purchasedBy: userRef(user._id) } };
});

// Transfers
const executeTransfer = (t, approver) => {
  const src = takeStock(t.asset, t.quantity);
  if (!src) throw new HttpError(400, `Insufficient stock at ${t.fromBase} to complete this transfer`);
  addStock({ name: t.assetName, assetType: t.assetType, base: t.toBase, quantity: t.quantity, unitCost: src.unitCost, userId: approver._id });
  Object.assign(t, { status: 'approved', approvedBy: approver._id, approvedAt: new Date().toISOString() });
};
route('GET', '/transfers', ({ user, query }) => {
  const base = scopedBase(user, query);
  const data = db.transfers.filter((t) => (!base || t.fromBase === base || t.toBase === base)
    && (!['pending', 'approved', 'rejected'].includes(query.status) || t.status === query.status)
    && (!ASSET_TYPES.includes(query.assetType) || t.assetType === query.assetType)
    && (!query.from && !query.to ? true : inRange(t.createdAt, query)))
    .sort(byDateDesc('createdAt')).map(popTransfer);
  return { success: true, count: data.length, data };
});
route('POST', '/transfers', ({ user, body, res }) => {
  const quantity = positiveInt(body.quantity);
  if (!BASES.includes(body.toBase)) throw new HttpError(400, 'Invalid destination base');
  const asset = db.assets.find((a) => a._id === body.assetId);
  if (!asset) throw new HttpError(404, 'Asset not found');
  if (!canAccessBase(user, asset.base)) throw new HttpError(403, 'You can only transfer assets out of your own base');
  if (asset.base === body.toBase) throw new HttpError(400, 'Source and destination base must differ');
  if (asset.quantity < quantity) throw new HttpError(400, `Insufficient quantity. Available: ${asset.quantity}`);
  const now = new Date().toISOString();
  const t = {
    _id: newId(), asset: asset._id, assetName: asset.name, assetType: asset.assetType, fromBase: asset.base, toBase: body.toBase,
    quantity, transferredBy: user._id, status: 'pending', approvedBy: null, approvedAt: null, notes: body.notes || '', decisionNote: '', createdAt: now,
  };
  const auto = user.role !== 'logistics_officer';
  if (auto) executeTransfer(t, user);
  db.transfers.push(t);
  res.audit = {
    action: auto ? 'TRANSFER_EXECUTE' : 'TRANSFER_REQUEST', entity: 'Transfer', entityId: t._id, base: asset.base,
    summary: `${quantity} × ${asset.name}: ${asset.base} → ${body.toBase}${auto ? '' : ' (awaiting approval)'}`,
  };
  return { status: 201, success: true, message: auto ? `Transferred ${quantity} × ${asset.name} to ${body.toBase}` : 'Transfer request submitted — awaiting commander approval', data: popTransfer(t) };
});
const decide = (approve) => ({ user, params, body, res }) => {
  authorize(user, 'admin', 'base_commander');
  const t = db.transfers.find((x) => x._id === params.id);
  if (!t) throw new HttpError(404, 'Transfer not found');
  if (!canAccessBase(user, t.fromBase)) throw new HttpError(403, 'Only the sending base commander or an admin can decide this transfer');
  if (t.status !== 'pending') throw new HttpError(400, `Transfer is already ${t.status}`);
  t.decisionNote = body?.note || '';
  if (approve) executeTransfer(t, user);
  else Object.assign(t, { status: 'rejected', approvedBy: user._id, approvedAt: new Date().toISOString() });
  res.audit = {
    action: approve ? 'TRANSFER_APPROVE' : 'TRANSFER_REJECT', entity: 'Transfer', entityId: t._id, base: t.fromBase,
    summary: `${approve ? 'Approved' : 'Rejected'} ${t.quantity} × ${t.assetName}: ${t.fromBase} → ${t.toBase}`,
  };
  return { success: true, message: `Transfer ${approve ? 'approved' : 'rejected'}`, data: popTransfer(t) };
};
route('PUT', '/transfers/:id/approve', decide(true));
route('PUT', '/transfers/:id/reject', decide(false));

// Assignments & expenditures
route('GET', '/assignments', ({ user, query }) => {
  authorize(user, 'admin', 'base_commander');
  const base = scopedBase(user, query);
  const data = db.assignments.filter((a) => (!base || a.base === base)
    && (!['active', 'returned', 'expended'].includes(query.status) || a.status === query.status)
    && (!ASSET_TYPES.includes(query.assetType) || a.assetType === query.assetType)
    && (!query.from && !query.to ? true : inRange(a.assignedAt, query))
    && (!query.search || matches(a.assignedTo, query.search) || matches(a.assetName, query.search)))
    .sort(byDateDesc('assignedAt'))
    .map((a) => ({ ...a, assignedBy: userRef(a.assignedBy), closedBy: a.closedBy ? userRef(a.closedBy) : null }));
  return { success: true, count: data.length, data };
});
route('POST', '/assignments', ({ user, body, res }) => {
  authorize(user, 'admin', 'base_commander');
  const quantity = positiveInt(body.quantity);
  if (!body.assignedTo?.trim()) throw new HttpError(400, 'Assignee name is required');
  const asset = db.assets.find((a) => a._id === body.assetId);
  if (!asset) throw new HttpError(404, 'Asset not found');
  if (!canAccessBase(user, asset.base)) throw new HttpError(403, 'You can only assign assets from your own base');
  if (!takeStock(asset._id, quantity)) throw new HttpError(400, `Insufficient quantity. Available: ${asset.quantity}`);
  const now = new Date().toISOString();
  const a = {
    _id: newId(), asset: asset._id, assetName: asset.name, assetType: asset.assetType, assignedTo: body.assignedTo.trim(),
    serviceId: body.serviceId || '', rank: body.rank || '', unit: body.unit || '', base: asset.base, quantity,
    assignedBy: user._id, purpose: body.purpose || '', assignedAt: now, status: 'active', closedAt: null, closedBy: null, createdAt: now,
  };
  db.assignments.push(a);
  res.audit = { action: 'ASSIGNMENT_CREATE', entity: 'Assignment', entityId: a._id, base: a.base, summary: `Assigned ${quantity} × ${asset.name} to ${[a.rank, a.assignedTo].filter(Boolean).join(' ')}` };
  return { status: 201, success: true, message: `${quantity} × ${asset.name} assigned to ${a.assignedTo}`, data: a };
});
const activeAssignment = (user, id) => {
  authorize(user, 'admin', 'base_commander');
  const a = db.assignments.find((x) => x._id === id);
  if (!a || !canAccessBase(user, a.base)) throw new HttpError(404, 'Assignment not found');
  if (a.status !== 'active') throw new HttpError(400, `Assignment is already ${a.status}`);
  return a;
};
route('PUT', '/assignments/:id/return', ({ user, params, res }) => {
  const a = activeAssignment(user, params.id);
  const asset = db.assets.find((x) => x._id === a.asset);
  asset.quantity += a.quantity; asset.updatedAt = new Date().toISOString();
  Object.assign(a, { status: 'returned', closedAt: new Date().toISOString(), closedBy: user._id });
  res.audit = { action: 'ASSIGNMENT_RETURN', entity: 'Assignment', entityId: a._id, base: a.base, summary: `${a.assignedTo} returned ${a.quantity} × ${a.assetName}` };
  return { success: true, message: 'Assets returned to stock', data: a };
});
route('PUT', '/assignments/:id/expend', ({ user, params, body, res }) => {
  const a = activeAssignment(user, params.id);
  const reason = REASONS.includes(body.reason) ? body.reason : 'other';
  const now = new Date().toISOString();
  const e = {
    _id: newId(), asset: a.asset, assetName: a.assetName, assetType: a.assetType, quantity: a.quantity, base: a.base, expendedBy: user._id,
    reason, notes: body.notes || `Expended by ${a.assignedTo}`, assignment: a._id, expendedAt: now, createdAt: now,
  };
  db.expenditures.push(e);
  Object.assign(a, { status: 'expended', closedAt: now, closedBy: user._id });
  res.audit = { action: 'ASSIGNMENT_EXPEND', entity: 'Expenditure', entityId: e._id, base: a.base, summary: `${a.quantity} × ${a.assetName} assigned to ${a.assignedTo} marked expended (${reason})` };
  return { success: true, message: 'Assignment marked as expended', data: a };
});
route('GET', '/expenditures', ({ user, query }) => {
  authorize(user, 'admin', 'base_commander');
  const base = scopedBase(user, query);
  const data = db.expenditures.filter((e) => (!base || e.base === base)
    && (!ASSET_TYPES.includes(query.assetType) || e.assetType === query.assetType)
    && (!query.from && !query.to ? true : inRange(e.expendedAt, query)))
    .sort(byDateDesc('expendedAt')).map((e) => ({ ...e, expendedBy: userRef(e.expendedBy) }));
  return { success: true, count: data.length, data };
});
route('POST', '/expenditures', ({ user, body, res }) => {
  authorize(user, 'admin', 'base_commander');
  const quantity = positiveInt(body.quantity);
  if (!REASONS.includes(body.reason)) throw new HttpError(400, 'Invalid reason');
  const asset = db.assets.find((a) => a._id === body.assetId);
  if (!asset) throw new HttpError(404, 'Asset not found');
  if (!canAccessBase(user, asset.base)) throw new HttpError(403, 'You can only expend assets from your own base');
  if (!takeStock(asset._id, quantity)) throw new HttpError(400, `Insufficient quantity. Available: ${asset.quantity}`);
  const now = new Date().toISOString();
  const e = {
    _id: newId(), asset: asset._id, assetName: asset.name, assetType: asset.assetType, quantity, base: asset.base, expendedBy: user._id,
    reason: body.reason, notes: body.notes || '', assignment: null, expendedAt: now, createdAt: now,
  };
  db.expenditures.push(e);
  res.audit = { action: 'EXPENDITURE_CREATE', entity: 'Expenditure', entityId: e._id, base: e.base, summary: `Expended ${quantity} × ${asset.name} (${body.reason})` };
  return { status: 201, success: true, message: `${quantity} × ${asset.name} logged as expended`, data: e };
});

// Audit
route('GET', '/audit', ({ user, query }) => {
  authorize(user, 'admin', 'base_commander');
  const base = scopedBase(user, query);
  const scoped = db.audit.filter((l) => !base || l.base === base);
  const filtered = scoped.filter((l) => (!query.action || l.action === query.action)
    && (query.success === undefined || String(l.success) === query.success)
    && (!query.from && !query.to ? true : inRange(l.createdAt, query))
    && (!query.search || matches(l.summary, query.search) || matches(l.userName, query.search)))
    .sort(byDateDesc('createdAt'));
  const limit = Math.min(200, Number(query.limit) || 50);
  return { success: true, total: filtered.length, page: 1, pages: Math.ceil(filtered.length / limit), actions: [...new Set(scoped.map((l) => l.action))].sort(), data: filtered.slice(0, limit) };
});

// Dashboard — identical formulas to server/routes/dashboard.js
route('GET', '/dashboard/summary', ({ user, query }) => {
  const base = scopedBase(user, query);
  const assetType = ASSET_TYPES.includes(query.assetType) ? query.assetType : null;
  const to = endOfDay(query.to || new Date());
  const from = startOfDay(query.from || new Date(to.getTime() - 29 * DAY));
  if (from > to) throw new HttpError(400, 'Invalid date range');
  const typeOk = (x) => !assetType || x.assetType === assetType;

  const sources = {
    purchases:   { rows: db.purchases, date: 'purchaseDate', ok: (x) => !base || x.base === base, by: 'purchasedBy' },
    transferIn:  { rows: db.transfers, date: 'approvedAt', ok: (x) => x.status === 'approved' && (!base || x.toBase === base), by: 'transferredBy' },
    transferOut: { rows: db.transfers, date: 'approvedAt', ok: (x) => x.status === 'approved' && (!base || x.fromBase === base), by: 'transferredBy' },
    expended:    { rows: db.expenditures, date: 'expendedAt', ok: (x) => !base || x.base === base, by: 'expendedBy' },
    assigned:    { rows: db.assignments, date: 'assignedAt', ok: (x) => !base || x.base === base, by: 'assignedBy' },
  };
  const zero = () => Object.fromEntries(ASSET_TYPES.map((t) => [t, 0]));
  const prior = {}; const period = {}; const docs = {};
  for (const [k, s] of Object.entries(sources)) {
    prior[k] = zero(); period[k] = zero(); docs[k] = [];
    for (const r of s.rows) {
      if (!typeOk(r) || !s.ok(r) || !r[s.date]) continue;
      const t = new Date(r[s.date]);
      if (t < from) prior[k][r.assetType] += r.quantity;
      else if (t <= to) { period[k][r.assetType] += r.quantity; docs[k].push(r); }
    }
    docs[k].sort(byDateDesc(s.date));
  }

  const byType = ASSET_TYPES.filter((t) => !assetType || t === assetType).map((type) => {
    const opening = prior.purchases[type] + prior.transferIn[type] - prior.transferOut[type] - prior.expended[type];
    const netMovement = period.purchases[type] + period.transferIn[type] - period.transferOut[type];
    return {
      assetType: type, opening, purchases: period.purchases[type], transferIn: period.transferIn[type], transferOut: period.transferOut[type],
      netMovement, assigned: period.assigned[type], expended: period.expended[type], closing: opening + netMovement - period.expended[type],
    };
  });
  const sum = (k) => byType.reduce((s, r) => s + r[k], 0);
  const metrics = {
    openingBalance: sum('opening'), purchases: sum('purchases'), transferIn: sum('transferIn'), transferOut: sum('transferOut'),
    assigned: sum('assigned'), expended: sum('expended'),
  };
  metrics.netMovement = metrics.purchases + metrics.transferIn - metrics.transferOut;
  metrics.closingBalance = metrics.openingBalance + metrics.netMovement - metrics.expended;

  const days = Math.round((to - from) / DAY) + 1;
  const bucketDays = days > 92 ? 7 : 1;
  const n = Math.ceil(days / bucketDays);
  const trend = Array.from({ length: n }, (_, i) => ({
    date: new Date(from.getTime() + i * bucketDays * DAY).toISOString().slice(0, 10),
    purchases: 0, transferIn: 0, transferOut: 0, expended: 0, assigned: 0, balance: 0,
  }));
  for (const [k, s] of Object.entries(sources)) {
    for (const d of docs[k]) trend[Math.min(n - 1, Math.floor((new Date(d[s.date]) - from) / (bucketDays * DAY)))][k] += d.quantity;
  }
  let running = metrics.openingBalance;
  for (const b of trend) { running += b.purchases + b.transferIn - b.transferOut - b.expended; b.balance = running; }

  const assets = db.assets.filter((a) => a.isActive && typeOk(a) && (!base || a.base === base));
  const active = db.assignments.filter((a) => a.status === 'active' && typeOk(a) && (!base || a.base === base));
  const byBase = {};
  for (const a of assets) (byBase[a.base] ||= { base: a.base, onHand: 0, assigned: 0 }).onHand += a.quantity;
  for (const a of active) (byBase[a.base] ||= { base: a.base, onHand: 0, assigned: 0 }).assigned += a.quantity;

  const who = (id) => userRef(id)?.name || '—';
  const lite = (list, f) => list.slice(0, 200).map(f);
  return {
    success: true,
    data: {
      range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      scope: { base: base || 'All Bases', assetType: assetType || 'All Types' },
      metrics, byType,
      byBase: Object.values(byBase).sort((a, b) => a.base.localeCompare(b.base)),
      trend,
      activeAssignments: active.reduce((s, a) => s + a.quantity, 0),
      pendingTransfers: db.transfers.filter((t) => t.status === 'pending' && typeOk(t) && (!base || t.fromBase === base || t.toBase === base)).length,
      lowStock: assets.filter((a) => a.quantity < (a.assetType === 'ammunition' ? 500 : 5)).sort((a, b) => a.quantity - b.quantity).slice(0, 8),
      recentActivity: db.audit.filter((l) => l.success && !l.action.startsWith('LOGIN') && (!base || l.base === base)).sort(byDateDesc('createdAt')).slice(0, 8),
      details: {
        purchases: lite(docs.purchases, (p) => ({ _id: p._id, date: p.purchaseDate, assetName: p.assetName, assetType: p.assetType, base: p.base, quantity: p.quantity, totalCost: p.totalCost, supplier: p.supplier, by: who(p.purchasedBy) })),
        transferIn: lite(docs.transferIn, (t) => ({ _id: t._id, date: t.approvedAt, assetName: t.assetName, assetType: t.assetType, fromBase: t.fromBase, toBase: t.toBase, quantity: t.quantity, by: who(t.transferredBy) })),
        transferOut: lite(docs.transferOut, (t) => ({ _id: t._id, date: t.approvedAt, assetName: t.assetName, assetType: t.assetType, fromBase: t.fromBase, toBase: t.toBase, quantity: t.quantity, by: who(t.transferredBy) })),
      },
    },
  };
});

// ── Axios adapter entry point ────────────────────────────────────────────────
const PUBLIC = new Set(['POST /auth/login', 'GET /health']);

export async function handle(config) {
  load();
  const url = new URL(config.url, 'http://demo.local/');
  const path = url.pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/';
  const method = (config.method || 'get').toUpperCase();
  const query = { ...Object.fromEntries(url.searchParams), ...(config.params || {}) };
  for (const k of Object.keys(query)) query[k] = String(query[k]);
  const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : config.data || {};
  const res = {};
  let status = 200;
  let payload;
  let user = null;
  const started = performance.now();

  await new Promise((r) => setTimeout(r, 120 + Math.random() * 180)); // feel like a network

  try {
    const r = routes.find((x) => x.method === method && x.re.test(path));
    if (!r) throw new HttpError(404, `Route ${method} ${path} not found`);

    if (!PUBLIC.has(`${method} ${path}`)) {
      const auth = config.headers?.Authorization || config.headers?.authorization || '';
      const id = auth.startsWith('Bearer demo.') ? auth.slice(12) : null;
      user = db.users.find((u) => u._id === id && u.isActive);
      if (!user) throw new HttpError(401, 'Not authorized — no token provided');
    }
    const m = path.match(r.re);
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const out = r.handler({ user, query, body, params, res });
    status = out.status || 200;
    delete out.status;
    payload = out;
  } catch (err) {
    status = err.status || 500;
    payload = { success: false, message: err.status ? err.message : 'Something went wrong' };
    if (!err.status) console.error(err);
  }

  if (method !== 'GET') {
    const actor = user || res.audit?.user || null;
    db.audit.push({
      _id: newId(), user: actor?._id || null, userName: actor?.name || body.email || 'anonymous', role: actor?.role || null,
      base: res.audit?.base || actor?.base || null, action: res.audit?.action || `${method} /api${path}`, entity: res.audit?.entity || null,
      entityId: res.audit?.entityId || null, summary: res.audit?.summary || (status >= 400 ? payload.message : ''), method, path: `/api${path}`,
      statusCode: status, success: status < 400, ip: '127.0.0.1', userAgent: navigator.userAgent, durationMs: Math.round(performance.now() - started),
      payload: body.password ? { ...body, password: '[REDACTED]' } : body, createdAt: new Date().toISOString(),
    });
    save();
  }

  const response = { data: payload, status, statusText: String(status), headers: {}, config, request: {} };
  if (status >= 400) {
    const error = new Error(payload.message);
    error.response = response;
    error.config = config;
    throw error;
  }
  return response;
}

export function resetDemo() {
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
  db = null;
}
