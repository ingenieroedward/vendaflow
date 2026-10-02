import { PlatformSetting } from '@/modules/tenant/platform-setting.model';
import logger from '@/core/logger';
import { recordJobRun } from './jobStatus';

const CHECK_EVERY_MS = 30 * 60 * 1000; // chequeo cada 30 min
const RUN_AFTER_HOUR = 7; // hora local del servidor (TZ=America/Bogota en compose)

/**
 * Corre `fn` una vez al día a partir de las 7:00 hora local, con la última
 * corrida persistida en platform_settings: un redeploy NO re-dispara los push
 * del mismo día (antes cada arranque enviaba de nuevo los recordatorios), y
 * si el server estuvo caído a la hora programada, corre al reconectar.
 * Marca el día ANTES de ejecutar (at-most-once: mejor perder un envío que duplicarlo).
 */
export function scheduleDailyJob(name: string, fn: () => Promise<void>): void {
  const key = `job_last_run_${name}`;
  const tick = async () => {
    try {
      const now = new Date();
      if (now.getHours() < RUN_AFTER_HOUR) return;
      const today = now.toLocaleDateString('en-CA'); // YYYY-MM-DD local
      const last = await PlatformSetting.findOne({ where: { key } });
      if (last?.value === today) return;
      if (last) await last.update({ value: today });
      else await PlatformSetting.create({ key, value: today });
      await fn();
      recordJobRun(name, true);
    } catch (err) {
      recordJobRun(name, false, String(err).slice(0, 120));
      logger.error(`[${name}] Run failed:`, err);
    }
  };
  setTimeout(tick, 90 * 1000);
  setInterval(tick, CHECK_EVERY_MS);
  logger.info(`[${name}] Job diario programado (>=${RUN_AFTER_HOUR}:00 local, dedup persistido)`);
}
