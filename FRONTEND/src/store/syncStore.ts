import { create } from 'zustand';

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

interface SyncState {
  status: SyncStatus;
  current: number;
  total: number;
  lastSync: string | null; // ISO string guardado en localStorage
  setProgress: (current: number, total: number) => void;
  setStatus: (status: SyncStatus) => void;
  setLastSync: () => void;
  reset: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  current: 0,
  total: 0,
  lastSync: localStorage.getItem('merco_last_sync'),

  setProgress: (current: number, total: number) => set({ current, total }),

  setStatus: (status: SyncStatus) => set({ status }),

  setLastSync: () => {
    const now = new Date().toISOString();
    localStorage.setItem('merco_last_sync', now);
    set({ lastSync: now });
  },

  reset: () => set({ status: 'idle', current: 0, total: 0 }),
}));
