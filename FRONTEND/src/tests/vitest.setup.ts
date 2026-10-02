// Instala IndexedDB simulado ANTES de que cualquier módulo (Dexie) lo capture
import 'fake-indexeddb/auto';

// CustomEvent no existe como global en Node 18 (el Docker build usa node:18-alpine)
if (typeof globalThis.CustomEvent === 'undefined') {
  class CustomEventPolyfill<T = unknown> extends Event {
    detail: T | undefined;
    constructor(type: string, options?: EventInit & { detail?: T }) {
      super(type, options);
      this.detail = options?.detail;
    }
  }
  (globalThis as Record<string, unknown>)['CustomEvent'] = CustomEventPolyfill;
}

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
