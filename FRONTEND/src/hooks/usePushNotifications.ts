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

  useEffect(() => {
    if (!supported) return;
    isSubscribed().then(setSubscribed).catch(() => {});
  }, [supported]);

  const toggle = async () => {
    setIsLoading(true);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        await requestPermissionAndSubscribe();
        setSubscribed(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return { isSupported: supported, isSubscribed: subscribed, isLoading, toggle };
}
