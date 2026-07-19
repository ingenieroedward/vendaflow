import React from 'react';
import { useSyncStore } from '../../store/syncStore';
import { useProductStore } from '../../store/productStore';
import { useOrderStore } from '../../store/orderStore';
import { useCustomerStore } from '../../store/customerStore';
import { useUserStore } from '../../store/userStore';

const TopLoadingBar: React.FC = () => {
  const { status, current, total } = useSyncStore();
  const productLoading = useProductStore(s => s.loading);
  const orderLoading = useOrderStore(s => s.loading);
  const customerLoading = useCustomerStore(s => s.loading);
  const userLoading = useUserStore(s => s.loading);

  const isSyncing = status === 'syncing';
  const isLoading = productLoading || orderLoading || customerLoading || userLoading;
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  const isVisible = isSyncing || isLoading;

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-primary/20 overflow-hidden">
      {isSyncing ? (
        // Barra determinada con porcentaje real del sync
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      ) : (
        // Barra indeterminada para cargas normales
        <div className="h-full w-full bg-primary animate-loading-bar" />
      )}
    </div>
  );
};

export default TopLoadingBar;
