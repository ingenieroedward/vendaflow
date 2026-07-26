// Instala IndexedDB simulado ANTES de que cualquier módulo (Dexie) lo capture
import 'fake-indexeddb/auto';

// Node ≥22 expone un localStorage experimental NO funcional sin flag —
// se sobreescribe siempre con un stub en memoria
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  } as Storage,
});
