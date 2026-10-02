import { useState, useEffect } from 'react';
import {
  isSubscribed,
  requestPermissionAndSubscribe,
  unsubscribeFromPush,
} from '../services/pushNotifications';

interface UsePushNotificationsResult {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  /** El navegador tiene el permiso bloqueado a nivel de sitio — reintentar no vuelve a preguntar */
  isDenied: boolean;
  error: string | null;
  clearError: () => void;
  toggle: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const [subscribed, setSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDenied, setIsDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    isSubscribed().then(setSubscribed).catch(() => {});
    setIsDenied(Notification.permission === 'denied');
  }, [supported]);

  const toggle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        await requestPermissionAndSubscribe();
        setSubscribed(true);
        setIsDenied(false);
      }
    } catch (e: unknown) {
      // Antes este error se perdía en silencio (try/finally sin catch) — el
      // botón de notificaciones simplemente no hacía nada visible si el
      // usuario bloqueaba el permiso por accidente o si subscribe() fallaba.
      const denied = typeof Notification !== 'undefined' && Notification.permission === 'denied';
      setIsDenied(denied);
      setError(
        denied
          ? 'Las notificaciones están bloqueadas para este sitio — actívalas desde el ícono de candado en la barra de direcciones e intenta de nuevo.'
          : ((e as { message?: string })?.message ?? 'No se pudo activar las notificaciones, intenta de nuevo.'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return { isSupported: supported, isSubscribed: subscribed, isLoading, isDenied, error, clearError: () => setError(null), toggle };
}
