import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Algo salió mal</h2>
            <p className="text-gray-500 mb-6 text-sm">
              {this.state.error?.message || 'Error inesperado'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
