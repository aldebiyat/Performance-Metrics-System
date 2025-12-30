import React from 'react';
import './ErrorBanner.css';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss, onRetry }) => {
  return (
    <div className="error-banner">
      <div className="error-content">
        <span className="error-icon">!</span>
        <span className="error-message">{message}</span>
      </div>
      <div className="error-actions">
        {onRetry && (
          <button className="error-btn error-btn-retry" onClick={onRetry}>
            Retry
          </button>
        )}
        {onDismiss && (
          <button className="error-btn error-btn-dismiss" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorBanner;
