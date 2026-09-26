// Integration tests against an in-memory MongoDB: `npm test`
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-secret';
process.env.USE_MEMORY_DB = 'true';

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const app = require('../app');
const { seedDemoData } = require('../seed');
const Asset = require('../models/Asset');
const Assignment = require('../models/Assignment');
const AuditLog = require('../models/AuditLog');

let server;
let baseUrl;
const tokens = {};

const api = async (method, path, { token, body } = {}) => {
  const res = await fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

const summary = async (token, params) =>
  (await api('GET', `/api/dashboard/summary?${new URLSearchParams(params)}`, { token })).body.data;

const today = new Date().toISOString().slice(0, 10);

// Holdings = stock on the shelf + stock issued to personnel
const holdings = async (base) => {
  const match = base ? { base } : {};
  const [onHand] = await Asset.aggregate([{ $match: match }, { $group: { _id: null, t: { $sum: '$quantity' } } }]);
  const [assigned] = await Assignment.aggregate([{ $match: { ...match, status: 'active' } }, { $group: { _id: null, t: { $sum: '$quantity' } } }]);
  return (onHand?.t || 0) + (assigned?.t || 0);
};

before(async () => {
  await connectDB();
  await seedDemoData({ log: () => {} });
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const logins = {
    admin: ['admin@military.com', 'admin123'],
    alpha: ['commander.alpha@military.com', 'commander123'],
    bravo: ['commander.bravo@military.com', 'commander123'],
    logistics: ['logistics.alpha@military.com', 'logistics123'],
  };
  for (const [k, [email, password]] of Object.entries(logins)) {
    const res = await api('POST', '/api/auth/login', { body: { email, password } });
    assert.equal(res.status, 200, `login ${k}`);
    tokens[k] = res.body.token;
  }
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  process.exit(0);
});

test('closing balance over all history reconciles with actual holdings', async () => {
  const s = await summary(tokens.admin, { from: '2000-01-01', to: today });
  assert.equal(s.metrics.openingBalance, 0);
  assert.equal(s.metrics.closingBalance, await holdings());

  const alpha = await summary(tokens.admin, { from: '2000-01-01', to: today, base: 'Base Alpha' });
  assert.equal(alpha.metrics.closingBalance, await holdings('Base Alpha'));
});

test('closing of one period equals opening of the next', async () => {
  const d = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const first = await summary(tokens.admin, { from: d(90), to: d(31), base: 'Base Bravo' });
  const second = await summary(tokens.admin, { from: d(30), to: today, base: 'Base Bravo' });
  assert.equal(first.metrics.closingBalance, second.metrics.openingBalance);
  assert.equal(
    second.metrics.closingBalance,
    second.metrics.openingBalance + second.metrics.netMovement - second.metrics.expended
  );
});

test('unauthenticated requests are rejected', async () => {
  assert.equal((await api('GET', '/api/purchases')).status, 401);
});

test('commanders are pinned to their own base even if they ask for another', async () => {
  const res = await api('GET', '/api/purchases?base=Base%20Bravo', { token: tokens.alpha });
  assert.equal(res.status, 200);
  assert.ok(res.body.data.length > 0);
  assert.ok(res.body.data.every((p) => p.base === 'Base Alpha'));

  const denied = await api('POST', '/api/purchases', {
    token: tokens.alpha,
    body: { assetName: 'M4A1 Carbine', assetType: 'weapon', base: 'Base Bravo', quantity: 5 },
  });
  assert.equal(denied.status, 403);
});

test('logistics officers cannot access assignments, expenditures, audit or users', async () => {
  for (const path of ['/api/assignments', '/api/expenditures', '/api/audit', '/api/users']) {
    assert.equal((await api('GET', path, { token: tokens.logistics })).status, 403, path);
  }
});

test('a purchase increases stock, closing balance and is audit-logged', async () => {
  const beforeSummary = await summary(tokens.alpha, { from: today, to: today });
  const res = await api('POST', '/api/purchases', {
    token: tokens.logistics,
    body: { assetName: 'M4A1 Carbine', assetType: 'weapon', base: 'Base Alpha', quantity: 25, unitCost: 1200 },
  });
  assert.equal(res.status, 201);

  const afterSummary = await summary(tokens.alpha, { from: today, to: today });
  assert.equal(afterSummary.metrics.purchases - beforeSummary.metrics.purchases, 25);
  assert.equal(afterSummary.metrics.closingBalance - beforeSummary.metrics.closingBalance, 25);

  await new Promise((r) => setTimeout(r, 100));
  const log = await AuditLog.findOne({ action: 'PURCHASE_CREATE', entityId: String(res.body.data._id) });
  assert.ok(log, 'audit entry written');
  assert.equal(log.role, 'logistics_officer');
});

test('logistics transfer needs approval from the sending base commander', async () => {
  const asset = await Asset.findOne({ base: 'Base Alpha', name: 'Tactical Radio AN/PRC-152' });
  const startQty = asset.quantity;

  const req = await api('POST', '/api/transfers', {
    token: tokens.logistics,
    body: { assetId: asset._id, toBase: 'Base Charlie', quantity: 3 },
  });
  assert.equal(req.status, 201);
  assert.equal(req.body.data.status, 'pending');
  assert.equal((await Asset.findById(asset._id)).quantity, startQty, 'no stock moves while pending');

  const id = req.body.data._id;
  assert.equal((await api('PUT', `/api/transfers/${id}/approve`, { token: tokens.logistics })).status, 403);
  assert.equal((await api('PUT', `/api/transfers/${id}/approve`, { token: tokens.bravo })).status, 403);

  const ok = await api('PUT', `/api/transfers/${id}/approve`, { token: tokens.alpha });
  assert.equal(ok.status, 200);
  assert.equal((await Asset.findById(asset._id)).quantity, startQty - 3);
  const dest = await Asset.findOne({ base: 'Base Charlie', name: 'Tactical Radio AN/PRC-152' });
  assert.ok(dest.quantity >= 3);
});

test('assignments cannot exceed stock and returns restore it', async () => {
  const asset = await Asset.findOne({ base: 'Base Alpha', name: 'M17 Pistol 9mm' });

  const tooMany = await api('POST', '/api/assignments', {
    token: tokens.alpha,
    body: { assetId: asset._id, assignedTo: 'Test Soldier', quantity: asset.quantity + 1 },
  });
  assert.equal(tooMany.status, 400);

  const res = await api('POST', '/api/assignments', {
    token: tokens.alpha,
    body: { assetId: asset._id, assignedTo: 'Test Soldier', rank: 'Pvt.', quantity: 2 },
  });
  assert.equal(res.status, 201);
  assert.equal((await Asset.findById(asset._id)).quantity, asset.quantity - 2);

  const ret = await api('PUT', `/api/assignments/${res.body.data._id}/return`, { token: tokens.alpha });
  assert.equal(ret.status, 200);
  assert.equal((await Asset.findById(asset._id)).quantity, asset.quantity);
});

test('non-admins cannot manage users', async () => {
  const res = await api('POST', '/api/users', {
    token: tokens.alpha,
    body: { name: 'X', email: 'x@x.com', password: 'secret1', role: 'admin', base: 'Base Alpha' },
  });
  assert.equal(res.status, 403);
});
