# MilAsset — Military Asset Management System

A role-based system for commanders and logistics personnel to track the purchase, movement, assignment and expenditure of critical assets (vehicles, weapons, ammunition, equipment) across multiple bases, with full accountability.

**Live app:** https://milasset.onrender.com

One-click sign-in buttons for each role are on the login screen. The deployment is the full stack (Express API + MongoDB + React) running as a single Render service, seeded with demo data. It is on Render's free plan, so after a period of inactivity the first request takes about 50 seconds while the server wakes up; the login page shows a notice while it does.

| Role | Email | Password | Scope |
|---|---|---|---|
| Admin | `admin@military.com` | `admin123` | All bases, all operations |
| Base Commander | `commander.alpha@military.com` | `commander123` | Base Alpha (also `.bravo`, `.charlie`, `.delta`) |
| Logistics Officer | `logistics.alpha@military.com` | `logistics123` | Purchases & transfer requests for Base Alpha (also `.bravo`) |

---

## Features

**Dashboard**
- Opening Balance, Closing Balance, Net Movement, Assigned and Expended for any period.
- Filters: date range (with 7D / 30D / 90D / All presets), base and equipment type.
- **Net Movement pop-up** (bonus): click the tile to drill into Purchases, Transfer In and Transfer Out, each a sortable table you can export.
- Balance ledger per equipment type showing exactly how each closing balance is derived.
- Holdings-over-time chart, inflow/outflow chart, holdings by base (on hand vs. issued), low-stock alerts, recent activity and pending-approval count.

**Purchases:** record purchases per base (supplier, PO reference, unit cost, date); history with date, base, type and text filters; quantity and procurement-value totals.

**Transfers:** move assets between bases with a timestamped history and a per-transfer timeline. Transfers use **maker–checker** approval: logistics officers raise requests, and the sending base's commander (or an admin) approves or rejects them. Stock only moves on approval.

**Assignments & Expenditures:** issue assets to personnel (rank, service ID, unit, purpose), process returns, mark assigned items as expended, and record direct expenditures (e.g. training ammunition) with a reason.

**Inventory:** current on-hand stock per base with stock value and health status.

**Audit log:** every state-changing request, successful *or rejected*, is recorded with user, role, base, action, entity, status code, IP, user agent, latency and the sanitised payload. Filterable and inspectable.

**User management (admin):** create users and change role, base or active status. The page includes the permission matrix.

**Everywhere:** responsive layout (desktop sidebar, mobile drawer, bottom-sheet modals), animated transitions, sortable and paginated tables, CSV export, and toasts for every outcome.

---

## Architecture

```
client/  React 19 + Vite, React Router, Recharts, Framer Motion
   │  JWT in Authorization header
   ▼
server/  Node.js + Express REST API
   ├─ helmet, CORS, rate limiting (global + login brute-force limiter)
   ├─ auditLogger middleware  → AuditLog collection (every POST/PUT/PATCH/DELETE)
   ├─ protect  (JWT → user, rejects deactivated accounts)
   ├─ authorize(...roles)      role gate per router/route
   ├─ scopedBase(req)          pins non-admins to their own base
   └─ routes → Mongoose models → MongoDB
```

In production a single Node service serves both the API (`/api/*`) and the built React app, so there is one URL and no CORS configuration.

### Why this stack

| Choice | Reason |
|---|---|
| **Node.js + Express** | Lightweight, mature and middleware-centric, which maps directly onto the requirements: authentication, RBAC and audit logging are each one composable middleware rather than code repeated in every handler. Same language as the frontend. |
| **MongoDB + Mongoose** | See below. |
| **JWT (stateless)** | Horizontally scalable; the token carries identity, and the user is re-loaded on every request so a deactivated account or role change takes effect immediately. |
| **React + Vite** | Fast builds, component model suited to a dashboard; Recharts for charts, Framer Motion for transitions. |

### Database choice and design

**MongoDB** (a document database) was chosen because:

1. **Ledger records are self-contained events.** A purchase, transfer or expenditure is written once and read many times. Each document denormalises what it needs (asset name, type, base), so history stays correct even if an asset line is later renamed. Reports need no joins.
2. **Aggregation pipelines** compute the dashboard (`$match` by base, type and date → `$group` by type) close to the data. Compound indexes such as `{ base, assetType, purchaseDate }` serve exactly those queries.
3. **Atomic conditional updates** (`findOneAndUpdate({ _id, quantity: { $gte: n } }, { $inc: { quantity: -n } })`) make stock deductions race-free without multi-document transactions. Two concurrent requests can never overdraw an asset.
4. **Flexible schema** for asset metadata that varies by type, and free hosting (Atlas) with an embedded in-memory mode for local runs and tests.

A relational database (PostgreSQL) would also be a sound choice, since the domain has clear entities and foreign keys. The design below is deliberately table-shaped, so porting it is straightforward.

**Collections**

| Collection | Role | Key fields |
|---|---|---|
| `users` | Accounts & roles | name, email (unique), bcrypt password, role, base, isActive |
| `assets` | **Current on-hand stock** per asset line per base | name + assetType + base (unique), quantity ≥ 0, unitCost |
| `purchases` | Ledger: stock entering a base | asset, base, assetType, quantity, unitCost, totalCost, supplier, reference, purchaseDate, purchasedBy |
| `transfers` | Ledger: stock moving between bases | asset, fromBase, toBase, quantity, status (pending/approved/rejected), transferredBy, approvedBy, approvedAt |
| `assignments` | Items issued to personnel | asset, assignedTo, rank, serviceId, unit, base, quantity, status (active/returned/expended), assignedAt, closedAt |
| `expenditures` | Ledger: stock leaving holdings permanently | asset, base, quantity, reason, assignment (if from an assignment), expendedAt |
| `auditlogs` | Append-only audit trail | user, role, base, action, entity, entityId, method, path, statusCode, success, ip, payload, createdAt |

### How balances are computed

Balances are **derived from the ledger, never stored**, so they are reproducible for any date range, base and equipment type:

```
Holdings        = everything a base owns, including items issued to personnel
Net Movement    = Purchases + Transfers In − Transfers Out
Opening Balance = Σ (Purchases + In − Out − Expended) before the start date
Closing Balance = Opening + Net Movement − Expended   (within the period)
Assigned        = units issued to personnel in the period (reported separately)
```

Assignments do not reduce holdings, because the base still owns a rifle it has issued. They reduce *available* stock (`assets.quantity`) until returned. An assigned item that is later expended creates an expenditure, which then reduces holdings. Transfers are dated by `approvedAt`, the moment stock actually moved.

The tests prove the ledger reconciles: the closing balance over all history equals `Σ assets.quantity + Σ active assignments`, and the closing balance of one period equals the opening balance of the next.

---

## Role-based access control

Enforced server-side by `authorize()` and `scopedBase()` middleware; the UI hides what a role can't use, but the API is the source of truth.

| Capability | Admin | Base Commander | Logistics Officer |
|---|---|---|---|
| Dashboard, inventory | All bases | Own base | Own base |
| Record purchases | ✓ | Own base | Own base |
| Transfers | Execute any | Execute from own base | Request only (needs approval) |
| Approve / reject transfers | ✓ | Outgoing from own base | — |
| Assignments & expenditures | ✓ | Own base | — |
| Audit log | All bases | Own base | — |
| User management | ✓ | — | — |

Non-admins who pass `?base=Other Base` are silently pinned to their own base. Writes to another base return `403`.

---

## API reference

All routes are prefixed with `/api` and require `Authorization: Bearer <token>` except login and health.

| Method | Route | Roles | Description |
|---|---|---|---|
| POST | `/auth/login` | public | Returns JWT + user (rate-limited) |
| GET | `/auth/me` | any | Current user |
| GET | `/health` | public | Liveness probe |
| GET | `/dashboard/summary?from&to&base&assetType` | any | Metrics, per-type ledger, trend, breakdown details |
| GET | `/assets?base&assetType&search&inStock` | any | Current stock |
| PUT | `/assets/:id` | admin, commander | Edit metadata (never quantity) |
| GET / POST | `/purchases` | all roles | List (filters: `from,to,base,assetType,search`) / record purchase |
| GET / POST | `/transfers` | all roles | List (filters: `from,to,base,status,assetType,direction`) / create |
| PUT | `/transfers/:id/approve` · `/reject` | admin, commander | Decide a pending transfer |
| GET / POST | `/assignments` | admin, commander | List / assign to personnel |
| PUT | `/assignments/:id/return` · `/expend` | admin, commander | Close an assignment |
| GET / POST | `/expenditures` | admin, commander | List / record direct expenditure |
| GET | `/audit?from&to&base&action&success&search&page&limit` | admin, commander | Audit trail |
| GET / POST / PUT | `/users`, `/users/:id` | admin | Manage accounts |

Errors use one shape, `{ "success": false, "message": "..." }`, with correct status codes (400 validation, 401 auth, 403 role/base, 404, 500).

---

## Security

- Passwords hashed with bcrypt; password never returned by the API.
- JWT with expiry; user re-validated on every request (deactivation is immediate).
- Public self-registration removed (it previously allowed anyone to create an admin); only admins create users.
- `helmet` security headers, JSON body size limit, global rate limit and a stricter login limiter.
- Input validation (whole positive quantities, known bases/types/reasons, no future purchase dates), regex-escaped search.
- Secrets redacted from audit payloads; failed and forbidden attempts are audited too.

---

## Running locally

Requires Node.js 18+. No database needed: without `MONGO_URI` the server starts an embedded MongoDB and seeds it with 7 users and ~120 days of history.

```bash
# API on :5000 with in-memory MongoDB + demo data
cd server && npm install && npm run dev:memory

# React dev server on :5173 (proxies /api to :5000)
cd client && npm install && npm run dev
```

To use your own MongoDB, copy `server/.env.example` to `server/.env` and set `MONGO_URI`. Then `npm run seed` (or `npm run seed -- --reset` to rebuild) loads the demo data.

**Tests:** `cd server && npm test` runs integration tests against an in-memory MongoDB. They cover ledger reconciliation, period continuity, RBAC base-pinning, role gates, audit logging, the transfer approval workflow and stock guards.

**Demo build:** `cd client && npm run build:demo` produces a static build that runs entirely in the browser (`client/src/api/mock/`).

## Deploying

The live app runs on Render. `render.yaml` is a one-click Render Blueprint: *New → Blueprint → select this repo*. It builds the client, serves it from Express, generates `JWT_SECRET`, and asks for `MONGO_URI` (a free MongoDB Atlas cluster). If `MONGO_URI` is left empty, the service runs on an in-memory database that is re-seeded on every start.

---

## Assumptions

- Four bases and four equipment classes are fixed configuration (`server/config/constants.js`).
- An *asset line* is a named item type at a base (e.g. "M4A1 Carbine @ Base Alpha") with a quantity. Serialised per-unit tracking would be the natural next step.
- Stock quantities only change through ledger transactions, so every number on the dashboard can be traced back to records.
