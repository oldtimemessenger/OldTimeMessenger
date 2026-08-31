import { createRoot } from 'react-dom/client';
import { setAuthTokenGetter, setUnauthorizedHandler } from '@workspace/api-client-react';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { getStoredAuthToken } from '@/lib/session';

import './index.css';

setAuthTokenGetter(getStoredAuthToken);
setUnauthorizedHandler(() => {
  localStorage.removeItem('old-time-user');
  if (window.location.pathname !== '/') window.location.assign('/');
});

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
