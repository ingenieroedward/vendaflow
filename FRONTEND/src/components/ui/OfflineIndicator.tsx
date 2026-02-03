import React, { useState, useEffect } from 'react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { WifiOff, Wifi } from 'lucide-react';

interface OfflineIndicatorProps {
  showOnlineMessage?: boolean; // Show brief message when coming back online
}

/**
 * Component that displays connection status
 * Shows a banner when offline, optionally shows a brief notification when back online
 */
const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  showOnlineMessage = true
}) => {
  const { isOnline, isOffline } = useNetworkStatus();
  const [showOnlineNotification, setShowOnlineNotification] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // When connection is restored
    if (isOnline && wasOffline && showOnlineMessage) {
      setShowOnlineNotification(true);

      // Hide the "back online" message after 3 seconds
      const timer = setTimeout(() => {
        setShowOnlineNotification(false);
        setWasOffline(false);
      }, 3000);

      return () => clearTimeout(timer);
    }

    // Track if we were offline
    if (isOffline) {
      setWasOffline(true);
    }
  }, [isOnline, isOffline, wasOffline, showOnlineMessage]);

  // Don't render anything if online (unless showing the "back online" notification)
  if (isOnline && !showOnlineNotification) {
    return null;
  }

  return (
    <>
      {/* Offline Banner - Persistent */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center space-x-2 text-sm sm:text-base">
              <WifiOff className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-medium">
                Modo Offline
              </span>
              <span className="hidden sm:inline text-yellow-100">
                - Los datos se sincronizarán cuando vuelva la conexión
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Online Notification - Temporary */}
      {showOnlineNotification && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-green-500 text-white shadow-lg animate-slide-down">
          <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center space-x-2 text-sm sm:text-base">
              <Wifi className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-medium">
                Conexión restablecida
              </span>
              <span className="hidden sm:inline text-green-100">
                - Sincronizando datos...
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OfflineIndicator;
