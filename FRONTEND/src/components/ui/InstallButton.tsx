import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface InstallButtonProps {
  className?: string;
}

const InstallButton: React.FC<InstallButtonProps> = ({ className }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallButton(false);
    }
  };

  const handleDismiss = () => {
    setShowInstallButton(false);
    setDeferredPrompt(null);
  };

  if (!showInstallButton) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 animate-bounce ${className}`}>
      {/* Desktop Version */}
      <div className="hidden sm:block">
        <button
          onClick={handleInstallClick}
          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full shadow-2xl border-2 border-white/20 backdrop-blur-sm hover:scale-105 transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center space-x-3 px-4 py-3">
            <div className="flex items-center space-x-2">
              <Download className="w-5 h-5 animate-pulse" />
              <span className="font-semibold text-sm">Instalar App</span>
            </div>
            <span className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-full text-xs font-medium">
              Instalar
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </button>
      </div>

      {/* Mobile Version */}
      <div className="sm:hidden">
        <button
          onClick={handleInstallClick}
          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full shadow-2xl border-2 border-white/20 backdrop-blur-sm hover:scale-105 transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center space-x-2 px-3 py-2">
            <Download className="w-4 h-4 animate-pulse" />
            <span className="font-semibold text-xs">Instalar</span>
            <span className="bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-full text-xs font-medium">
              +
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-all duration-200"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </button>
      </div>
    </div>
  );
};

export default InstallButton; 