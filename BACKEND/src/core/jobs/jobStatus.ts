// Registro en memoria de la última corrida de cada job — visible en superadmin.
// Se reinicia con cada deploy (los jobs corren ~1-2 min después del arranque).
const lastRuns: Record<string, { at: string; ok: boolean; note?: string }> = {};

export function recordJobRun(name: string, ok: boolean, note?: string): void {
  lastRuns[name] = { at: new Date().toISOString(), ok, ...(note ? { note } : {}) };
}

export function getJobStatuses(): Record<string, { at: string; ok: boolean; note?: string }> {
  return { ...lastRuns };
}
