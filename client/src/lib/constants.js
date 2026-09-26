import { FaTruckMonster, FaCrosshairs, FaBoxesStacked, FaToolbox } from 'react-icons/fa6';

export const BASES = ['Base Alpha', 'Base Bravo', 'Base Charlie', 'Base Delta'];
export const ASSET_TYPES = ['vehicle', 'weapon', 'ammunition', 'equipment'];
export const EXPENDITURE_REASONS = ['training', 'combat', 'maintenance', 'damaged', 'lost', 'other'];

export const TYPE_META = {
  vehicle:    { label: 'Vehicle',    plural: 'Vehicles',    color: '#3b82f6', Icon: FaTruckMonster },
  weapon:     { label: 'Weapon',     plural: 'Weapons',     color: '#d97706', Icon: FaCrosshairs },
  ammunition: { label: 'Ammunition', plural: 'Ammunition',  color: '#8b5cf6', Icon: FaBoxesStacked },
  equipment:  { label: 'Equipment',  plural: 'Equipment',   color: '#16a34a', Icon: FaToolbox },
};

export const ROLE_META = {
  admin:             { label: 'Admin',             color: 'var(--green)',  tone: 'green' },
  base_commander:    { label: 'Base Commander',    color: 'var(--amber)',  tone: 'amber' },
  logistics_officer: { label: 'Logistics Officer', color: 'var(--blue)',   tone: 'blue' },
};

// Movement colours used consistently across KPIs, charts and tables
export const MOVE = {
  purchases:   { label: 'Purchases',     color: '#16a34a' },
  transferIn:  { label: 'Transfer In',   color: '#3b82f6' },
  transferOut: { label: 'Transfer Out',  color: '#d97706' },
  assigned:    { label: 'Assigned',      color: '#8b5cf6' },
  expended:    { label: 'Expended',      color: '#ef4444' },
  balance:     { label: 'Balance',       color: '#5eead4' },
};

export const DEMO_ACCOUNTS = [
  { role: 'admin',             label: 'Admin',             email: 'admin@military.com',           password: 'admin123',     note: 'All bases · full access' },
  { role: 'base_commander',    label: 'Base Commander',    email: 'commander.alpha@military.com', password: 'commander123', note: 'Base Alpha only' },
  { role: 'logistics_officer', label: 'Logistics Officer', email: 'logistics.alpha@military.com', password: 'logistics123', note: 'Purchases & transfers' },
];

// What each role can see; mirrors the server-side authorize() middleware
export const ACCESS = {
  dashboard:   ['admin', 'base_commander', 'logistics_officer'],
  inventory:   ['admin', 'base_commander', 'logistics_officer'],
  purchases:   ['admin', 'base_commander', 'logistics_officer'],
  transfers:   ['admin', 'base_commander', 'logistics_officer'],
  assignments: ['admin', 'base_commander'],
  audit:       ['admin', 'base_commander'],
  users:       ['admin'],
};
