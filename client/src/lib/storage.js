// localStorage that never throws (private mode, blocked site data); falls back to memory
const memory = new Map();

export const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return memory.get(key) ?? null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { memory.set(key, value); }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    memory.delete(key);
  },
};
