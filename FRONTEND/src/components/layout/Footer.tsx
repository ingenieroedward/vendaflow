import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-4 sm:py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-2">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-1 sm:space-y-0 sm:space-x-4 text-xs text-gray-400">
            <span>© {new Date().getFullYear()} Merco. Todos los derechos reservados.</span>
           
            <span>
              Desarrollado por{' '}
              <a 
                href="https://edwsystem.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-500 transition-colors duration-200 font-medium"
              >
                Edwsystem
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 