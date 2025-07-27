import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export const useAuth = () => {
  const { checkAuth, ...authState } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return authState;
};