import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import OfflineIndicator from '../ui/OfflineIndicator';
import { useAuthStore } from '../../store/authStore';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Network status indicator */}
      <OfflineIndicator showOnlineMessage={true} />

      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile header */}
      <Header />

      {/* Main content
          - Desktop: offset left by sidebar width (w-56 = 224px)
          - Mobile: offset bottom by bottom nav height (h-16 = 64px) */}
      <main className="md:ml-56 pb-16 md:pb-0 min-h-screen">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
};

export default Layout;
