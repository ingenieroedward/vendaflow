import React, { useEffect } from 'react';
import AppRouter from './routes/AppRouter';
import { useAuthStore } from './store/authStore';
import { useUIStore } from './store/uiStore';
import ErrorBoundary from './components/ui/ErrorBoundary';

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useUIStore();

  return (
    <div className="fixed min-w-72 top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto overflow-hidden border-l-4 ${
            notification.type === 'success'
              ? 'border-green-500'
              : notification.type === 'error'
              ? 'border-red-500'
              : notification.type === 'warning'
              ? 'border-yellow-500'
              : 'border-blue-500'
          }`}
        >
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div
                  className={`w-2 h-2 rounded-full mt-2 ${
                    notification.type === 'success'
                      ? 'bg-green-500'
                      : notification.type === 'error'
                      ? 'bg-red-500'
                      : notification.type === 'warning'
                      ? 'bg-yellow-500'
                      : 'bg-blue-500'
                  }`}
                />
              </div>
              <div className="ml-3 w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {notification.title}
                </p>
                {notification.message && (
                  <p className="mt-1 text-sm text-gray-500">
                    {notification.message}
                  </p>
                )}
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <ErrorBoundary>
      <div className="App min-h-screen">
        <AppRouter />
        <NotificationContainer />
      </div>
    </ErrorBoundary>
  );
}

export default App;
