import { useState, useEffect } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  effectiveType?: string; // 'slow-2g', '2g', '3g', '4g'
  downlink?: number;
}

/**
 * Hook to detect and monitor network connection status
 * Returns online/offline state and connection quality if available
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionInfo, setConnectionInfo] = useState<{
    effectiveType?: string;
    downlink?: number;
  }>({});

  useEffect(() => {
    // Handler for online event
    const handleOnline = () => {
      setIsOnline(true);
      console.log('🌐 Connection restored - Online');
    };

    // Handler for offline event
    const handleOffline = () => {
      setIsOnline(false);
      console.log('📴 Connection lost - Offline');
    };

    // Handler for connection change (if supported)
    const handleConnectionChange = () => {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

      if (connection) {
        setConnectionInfo({
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
        });

        console.log(`📶 Connection changed: ${connection.effectiveType}, ${connection.downlink}Mbps`);
      }
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen to connection changes (Network Information API - if available)
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
      // Get initial connection info
      handleConnectionChange();
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    ...connectionInfo,
  };
}
