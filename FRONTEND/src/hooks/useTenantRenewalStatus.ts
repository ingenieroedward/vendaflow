import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getMyTenant } from '../services/tenant';

interface RenewalStatus {
  /** Días para que venza el trial (≤7), o null si no aplica */
  trialDaysLeft: number | null;
  /** Días para que venza el plan pago (≤7, negativo si ya venció), o null si no aplica */
  renewalDaysLeft: number | null;
}

// Aviso de trial/plan pago por vencer o vencido — mismo cálculo con
// trialEndsAt/paidUntil que ya usa el backend (trialExpiry.ts /
// subscriptionRenewal.ts) para decidir cuándo suspende. Solo admin, solo
// online (silencioso si falla — es un aviso informativo, no bloquea nada).
// Compartido entre Sidebar.tsx (desktop) y Header.tsx (mobile) para no
// duplicar la llamada a getMyTenant() ni el cálculo de fechas.
export function useTenantRenewalStatus(): RenewalStatus {
  const { user } = useAuthStore();
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [renewalDaysLeft, setRenewalDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin' || !navigator.onLine) return;
    getMyTenant().then(t => {
      if (!t) return;
      if (t.plan === 'trial') {
        if (t.trialEndsAt) {
          const days = Math.ceil((new Date(t.trialEndsAt).getTime() - Date.now()) / 86400000);
          if (days <= 7) setTrialDaysLeft(days);
        }
        return;
      }
      // paidUntil null = fuera del ciclo (cortesía/legado) — sin aviso
      if (t.paidUntil) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(`${t.paidUntil}T00:00:00`);
        const days = Math.round((due.getTime() - today.getTime()) / 86400000);
        if (days <= 7) setRenewalDaysLeft(days);
      }
    }).catch(() => {/* silencioso */});
  }, [user?.role]);

  return { trialDaysLeft, renewalDaysLeft };
}
