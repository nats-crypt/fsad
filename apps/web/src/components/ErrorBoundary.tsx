import { Component, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0a0f1e' }}>
          <div className="max-w-md w-full text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#e53e3e' }} />
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#e8dfc8', fontFamily: 'serif' }}>
              Something went wrong
            </h1>
            <p className="text-sm mb-6" style={{ color: '#8899aa' }}>
              {this.state.error.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => window.location.assign('/')}
              style={{ background: '#b8972a', color: '#0a0f1e', padding: '10px 24px', borderRadius: '8px', fontWeight: 600 }}
            >
              Go to Homepage
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
