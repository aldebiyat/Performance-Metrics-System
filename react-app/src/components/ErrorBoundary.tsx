import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', backgroundColor: 'var(--bg-primary, #f5f5f5)' }}>
          <div style={{ maxWidth: '500px', padding: '40px', backgroundColor: 'var(--bg-secondary, white)', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', textAlign: 'center' }}>
            <h1 style={{ margin: '0 0 16px', fontSize: '24px', color: 'var(--text-primary, #333)' }}>Something went wrong</h1>
            <p style={{ margin: '0 0 24px', color: 'var(--text-secondary, #666)' }}>
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre style={{ margin: '0 0 24px', padding: '16px', backgroundColor: '#fee', borderRadius: '4px', fontSize: '12px', textAlign: 'left', overflow: 'auto', maxHeight: '200px' }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={this.handleReset} style={{ padding: '10px 20px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Try Again
              </button>
              <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', backgroundColor: 'transparent', color: '#666', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
