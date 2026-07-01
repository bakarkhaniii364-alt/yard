import { canUseTestMode } from './lib/testMode.js';

if (typeof window !== 'undefined' && canUseTestMode()) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('test_mode') === 'true') {
    window.sessionStorage.setItem('yard_test_mode', 'true');
    const user = params.get('user');
    if (user) {
      window.sessionStorage.setItem('yard_test_user', user);
    }
  }
}

import React from 'react'
import { initMonitoring } from './utils/monitoring.js'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './components/UI.jsx'
import App from './App.jsx'
import './index.css'
import './styles/mobile.css'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'

import { AuthProvider } from './context/AuthContext.jsx'
import { SyncProvider } from './context/SyncContext.jsx'
import { CallProvider } from './context/CallContext.jsx'
import { ChatProvider } from './context/ChatContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <SyncProvider>
              <CallProvider>
                <ChatProvider>
                  <App />
                </ChatProvider>
              </CallProvider>
            </SyncProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

// Initialize monitoring (Sentry) if configured
if (typeof window !== 'undefined') {
  initMonitoring();
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('Yard Service Worker registered:', reg.scope))
      .catch((err) => console.error('Yard Service Worker registration failed:', err));
  });
}
