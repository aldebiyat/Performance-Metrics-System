import * as Sentry from '@sentry/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// Disable console methods in production to prevent information leakage
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.warn = () => {};
  console.debug = () => {};
  // Keep console.error for Sentry and critical issues
}

if (process.env.REACT_APP_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
  });
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA support
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    // Optional: Show update notification
    console.log('New version available! Refresh to update.');
  },
  onSuccess: (registration) => {
    console.log('App is ready for offline use.');
  },
});