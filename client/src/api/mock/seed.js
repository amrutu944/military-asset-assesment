// Browser port of server/seed.js — same catalog, same event simulation.
export const BASES = ['Base Alpha', 'Base Bravo', 'Base Charlie', 'Base Delta'];
export const ASSET_TYPES = ['vehicle', 'weapon', 'ammunition', 'equipment'];
export const REASONS = ['combat', 'training', 'maintenance', 'lost', 'damaged', 'other'];

const DAY = 864e5;
const HISTORY_DAYS = 120;

const USERS = [
  ['u-admin', 'Col. Sarah Mitchell', 'admin@military.com', 'admin123', 'admin', 'Base Alpha'],
  ['u-cmd-a', 'Lt. Col. James Carter', 'commander.alpha@military.com', 'commander123', 'base_commander', 'Base Alpha'],
  ['u-cmd-b', 'Maj. Priya Raman', 'commander.bravo@military.com', 'commander123', 'base_commander', 'Base Bravo'],
  ['u-cmd-c', 'Capt. Daniel Brooks', 'commander.charlie@military.com', 'commander123', 'base_commander', 'Base Charlie'],
  ['u-cmd-d', 'Maj. Elena Novak', 'commander.delta@military.com', 'commander123', 'base_commander', 'Base Delta'],
  ['u-log-a', 'Sgt. Ravi Kumar', 'logistics.alpha@military.com', 'logistics123', 'logistics_officer', 'Base Alpha'],
  ['u-log-b', 'Sgt. Maria Lopez', 'logistics.bravo@military.com', 'logistics123', 'logistics_officer', 'Base Bravo'],
];

const CATALOG = [
  { name: 'Humvee M1151', assetType: 'vehicle', unitCost: 220000, initial: [8, 14], buy: [1, 3] },
  { name: 'MRAP Cougar 4x4', assetType: 'vehicle', unitCost: 475000, initial: [3, 6], buy: [1, 2] },
  { name: 'Light Utility Truck', assetType: 'vehicle', unitCost: 65000, initial: [10, 18], buy: [2, 4] },
  { name: 'M4A1 Carbine', assetType: 'weapon', unitCost: 1200, initial: [120, 220], buy: [20, 60] },
  { name: 'M249 Light Machine Gun', assetType: 'weapon', unitCost: 4100, initial: [15, 30], buy: [4, 10] },
  { name: 'M17 Pistol 9mm', assetType: 'weapon', unitCost: 580, initial: [60, 110], buy: [10, 30] },
  { name: '5.56mm NATO Rounds', assetType: 'ammunition', unitCost: 0.45, initial: [40000, 80000], buy: [10000, 30000] },
  { name: '9mm Parabellum Rounds', assetType: 'ammunition', unitCost: 0.3, initial: [15000, 30000], buy: [5000, 12000] },
  { name: '40mm Grenade Cartridge', assetType: 'ammunition', unitCost: 38, initial: [600, 1400], buy: [200, 500] },
  { name: 'Night Vision Goggles PVS-14', assetType: 'equipment', unitCost: 3500, initial: [40, 90], buy: [10, 25] },
  { name: 'Tactical Radio AN/PRC-152', assetType: 'equipment', unitCost: 6800, initial: [30, 60], buy: [6, 15] },
  { name: 'Body Armor IOTV', assetType: 'equipment', unitCost: 1600, initial: [100, 180], buy: [20, 50] },
];

const SUPPLIERS = ['Defense Logistics Agency', 'General Dynamics', 'AM General', 'Oshkosh Defense', 'L3Harris', 'Colt Defense', 'Olin Winchester'];
const PERSONNEL = [
  ['Pvt.', 'Arjun Mehta'], ['Cpl.', "Liam O'Connor"], ['Sgt.', 'Aisha Khan'], ['Pvt.', 'Noah Williams'], ['Spc.', 'Chen Wei'],
  ['Cpl.', 'Fatima Hassan'], ['Sgt.', 'Lucas Martin'], ['Pvt.', 'Sofia Rossi'], ['Spc.', 'Ethan Clarke'], ['Lt.', 'Meera Iyer'],
  ['Sgt.', 'Owen Davies'], ['Cpl.', 'Hana Suzuki'], ['Pvt.', 'Mateo Garcia'], ['Spc.', 'Grace Kim'], ['Lt.', 'Vikram Singh'],
];
const UNITS = ['1st Infantry Platoon', 'Recon Squad B', 'Motor Transport Section', 'Signals Detachment', 'Quick Reaction Force'];
const PURPOSES = ['Border patrol rotation', 'Field training exercise', 'Convoy escort', 'Perimeter security', 'Joint exercise', 'Reconnaissance mission'];

const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function generate() {
  const rand = mulberry32(20260926);
  const between = (lo, hi) => Math.floor(lo + rand() * (hi - lo + 1));
  const pickOne = (arr) => arr[Math.floor(rand() * arr.length)];
  const roundTo = (n, step) => Math.max(step, Math.round(n / step) * step);
  let n = 0;
  const id = (p) => `${p}-${(n++).toString(36).padStart(5, '0')}`;
  const startedAt = new Date(Date.now() - HISTORY_DAYS * DAY).toISOString();

  const users = USERS.map(([_id, name, email, password, role, base]) => ({ _id, name, email, password, role, base, isActive: true, createdAt: startedAt }));
  const byId = Object.fromEntries(users.map((u) => [u._id, u]));
  const admin = byId['u-admin'];
  const commanderOf = Object.fromEntries(users.filter((u) => u.role === 'base_commander').map((u) => [u.base, u]));
  const logisticsOf = Object.fromEntries(users.filter((u) => u.role === 'logistics_officer').map((u) => [u.base, u]));
  const buyerFor = (base) => logisticsOf[base] || commanderOf[base] || admin;
  const stepFor = (item) => (item.assetType === 'ammunition' ? 100 : 1);

  const assets = {};
  const key = (base, name) => `${base}|${name}`;
  for (const base of BASES) for (const item of CATALOG) {
    assets[key(base, item.name)] = {
      _id: id('a'), name: item.name, assetType: item.assetType, base, quantity: 0, unitCost: item.unitCost, description: '',
      purchasedBy: buyerFor(base)._id, isActive: true, createdAt: startedAt, updatedAt: startedAt,
    };
  }

  const purchases = []; const transfers = []; const assignments = []; const expenditures = []; const audit = [];
  const log = (at, actor, action, entity, entityId, base, summary, method, path) => audit.push({
    _id: id('l'), user: actor._id, userName: actor.name, role: actor.role, base, action, entity, entityId, summary, method, path,
    statusCode: method === 'POST' ? 201 : 200, success: true, ip: `10.0.0.${between(2, 250)}`, userAgent: 'seed', durationMs: between(18, 140),
    payload: null, createdAt: at.toISOString(),
  });
  const at = (dayOffset, hour = between(7, 19)) => {
    const d = new Date(Date.now() - dayOffset * DAY);
    d.setUTCHours(hour, between(0, 59), between(0, 59), 0);
    return d > Date.now() ? new Date(Date.now() - between(5, 240) * 60000) : d;
  };
  const touch = (a, date) => { a.updatedAt = date.toISOString(); };

  const purchase = (date, base, item, quantity) => {
    const a = assets[key(base, item.name)];
    const buyer = buyerFor(base);
    a.quantity += quantity; touch(a, date);
    const p = {
      _id: id('p'), asset: a._id, assetName: item.name, assetType: item.assetType, base, quantity, unitCost: item.unitCost,
      totalCost: Math.round(item.unitCost * quantity * 100) / 100, supplier: pickOne(SUPPLIERS),
      reference: `PO-${date.getUTCFullYear()}-${purchases.length + 1001}`, notes: '', purchaseDate: date.toISOString(),
      purchasedBy: buyer._id, createdAt: date.toISOString(),
    };
    purchases.push(p);
    log(date, buyer, 'PURCHASE_CREATE', 'Purchase', p._id, base, `Purchased ${quantity} × ${item.name} (${item.assetType}) for ${base}`, 'POST', '/api/purchases');
  };

  const active = [];
  for (const base of BASES) for (const item of CATALOG) purchase(at(HISTORY_DAYS, 9), base, item, roundTo(between(...item.initial), stepFor(item)));

  for (let day = HISTORY_DAYS - 1; day >= 0; day--) {
    for (const base of BASES) {
      const commander = commanderOf[base] || admin;

      if (rand() < 0.22) { const item = pickOne(CATALOG); purchase(at(day), base, item, roundTo(between(...item.buy), stepFor(item))); }

      if (rand() < 0.12) {
        const item = pickOne(CATALOG);
        const src = assets[key(base, item.name)];
        const toBase = pickOne(BASES.filter((b) => b !== base));
        const qty = roundTo(Math.floor(src.quantity * (0.05 + rand() * 0.12)), stepFor(item));
        if (qty >= 1 && qty <= src.quantity) {
          const date = at(day);
          const byLogistics = logisticsOf[base] && rand() < 0.5;
          const requester = byLogistics ? logisticsOf[base] : commander;
          const approvedAt = byLogistics ? new Date(Math.min(Date.now(), date.getTime() + between(1, 20) * 3600000)) : date;
          const rejected = byLogistics && rand() < 0.12;
          const t = {
            _id: id('t'), asset: src._id, assetName: item.name, assetType: item.assetType, fromBase: base, toBase, quantity: qty,
            transferredBy: requester._id, status: rejected ? 'rejected' : 'approved', approvedBy: commander._id, approvedAt: approvedAt.toISOString(),
            notes: pickOne(['Operational redeployment', 'Rebalancing stock levels', 'Support for joint exercise', 'Surge requirement']),
            decisionNote: rejected ? 'Stock required locally for upcoming exercise' : '', createdAt: date.toISOString(),
          };
          transfers.push(t);
          if (byLogistics) log(date, requester, 'TRANSFER_REQUEST', 'Transfer', t._id, base, `${qty} × ${item.name}: ${base} → ${toBase} (awaiting approval)`, 'POST', '/api/transfers');
          if (!rejected) {
            src.quantity -= qty; touch(src, approvedAt);
            const dest = assets[key(toBase, item.name)]; dest.quantity += qty; touch(dest, approvedAt);
          }
          log(approvedAt, commander, byLogistics ? (rejected ? 'TRANSFER_REJECT' : 'TRANSFER_APPROVE') : 'TRANSFER_EXECUTE', 'Transfer', t._id, base,
            `${qty} × ${item.name}: ${base} → ${toBase}`, byLogistics ? 'PUT' : 'POST', '/api/transfers');
        }
      }

      if (rand() < 0.35) {
        const item = pickOne(CATALOG.filter((c) => c.assetType !== 'ammunition'));
        const a = assets[key(base, item.name)];
        const qty = item.assetType === 'vehicle' ? 1 : between(1, item.assetType === 'weapon' ? 4 : 6);
        if (a.quantity >= qty) {
          const [rank, name] = pickOne(PERSONNEL);
          const date = at(day);
          a.quantity -= qty; touch(a, date);
          const asg = {
            _id: id('s'), asset: a._id, assetName: item.name, assetType: item.assetType, assignedTo: name, rank, serviceId: `SVC-${between(10000, 99999)}`,
            unit: pickOne(UNITS), base, quantity: qty, assignedBy: commander._id, purpose: pickOne(PURPOSES), assignedAt: date.toISOString(),
            status: 'active', closedAt: null, closedBy: null, createdAt: date.toISOString(),
          };
          assignments.push(asg); active.push(asg);
          log(date, commander, 'ASSIGNMENT_CREATE', 'Assignment', asg._id, base, `Assigned ${qty} × ${item.name} to ${rank} ${name}`, 'POST', '/api/assignments');
        }
      }

      for (const asg of active.filter((x) => x.base === base && x.status === 'active')) {
        const ageDays = (Date.now() - day * DAY - new Date(asg.assignedAt).getTime()) / DAY;
        if (ageDays > 7 && rand() < 0.06) {
          const date = at(day);
          const expended = rand() < 0.15;
          Object.assign(asg, { status: expended ? 'expended' : 'returned', closedAt: date.toISOString(), closedBy: commander._id });
          if (expended) {
            const reason = pickOne(['damaged', 'lost', 'combat']);
            const e = {
              _id: id('e'), asset: asg.asset, assetName: asg.assetName, assetType: asg.assetType, quantity: asg.quantity, base, expendedBy: commander._id,
              reason, notes: `Expended by ${asg.rank} ${asg.assignedTo}`, assignment: asg._id, expendedAt: date.toISOString(), createdAt: date.toISOString(),
            };
            expenditures.push(e);
            log(date, commander, 'ASSIGNMENT_EXPEND', 'Expenditure', e._id, base, `${asg.quantity} × ${asg.assetName} assigned to ${asg.assignedTo} marked expended (${reason})`, 'PUT', '/api/assignments');
          } else {
            const a = assets[key(base, asg.assetName)]; a.quantity += asg.quantity; touch(a, date);
            log(date, commander, 'ASSIGNMENT_RETURN', 'Assignment', asg._id, base, `${asg.assignedTo} returned ${asg.quantity} × ${asg.assetName}`, 'PUT', '/api/assignments');
          }
        }
      }

      if (rand() < 0.3) {
        const ammo = rand() < 0.85;
        const item = pickOne(CATALOG.filter((c) => (ammo ? c.assetType === 'ammunition' : c.assetType === 'equipment')));
        const a = assets[key(base, item.name)];
        const qty = ammo ? roundTo(Math.floor(a.quantity * (0.02 + rand() * 0.05)), 100) : between(1, 3);
        if (qty >= 1 && qty <= a.quantity) {
          const date = at(day);
          const reason = ammo ? pickOne(['training', 'training', 'training', 'combat']) : pickOne(['damaged', 'maintenance', 'lost']);
          a.quantity -= qty; touch(a, date);
          const e = {
            _id: id('e'), asset: a._id, assetName: item.name, assetType: item.assetType, quantity: qty, base, expendedBy: commander._id, reason,
            notes: ammo ? 'Range qualification' : 'Written off after inspection', assignment: null, expendedAt: date.toISOString(), createdAt: date.toISOString(),
          };
          expenditures.push(e);
          log(date, commander, 'EXPENDITURE_CREATE', 'Expenditure', e._id, base, `Expended ${qty} × ${item.name} (${reason})`, 'POST', '/api/expenditures');
        }
      }
    }
  }

  for (const [base, officer] of Object.entries(logisticsOf)) {
    for (const item of [CATALOG[3], CATALOG[9]]) {
      const src = assets[key(base, item.name)];
      const toBase = pickOne(BASES.filter((b) => b !== base));
      const qty = Math.max(1, Math.floor(src.quantity * 0.1));
      const date = at(between(0, 2));
      const t = {
        _id: id('t'), asset: src._id, assetName: item.name, assetType: item.assetType, fromBase: base, toBase, quantity: qty,
        transferredBy: officer._id, status: 'pending', approvedBy: null, approvedAt: null, notes: 'Requested to support upcoming joint exercise',
        decisionNote: '', createdAt: date.toISOString(),
      };
      transfers.push(t);
      log(date, officer, 'TRANSFER_REQUEST', 'Transfer', t._id, base, `${qty} × ${item.name}: ${base} → ${toBase} (awaiting approval)`, 'POST', '/api/transfers');
    }
  }

  return { users, assets: Object.values(assets), purchases, transfers, assignments, expenditures, audit };
}
