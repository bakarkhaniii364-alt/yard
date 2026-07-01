// Simple client-side monitoring bootstrap (Sentry optional)
export function initMonitoring() {
  try {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn || typeof document === 'undefined') return;

    // Load Sentry from CDN to avoid bundler resolving an optional dependency
    const sentryCdn = import.meta.env.VITE_SENTRY_CDN || 'https://browser.sentry-cdn.com/7.63.0/bundle.min.js';

    if (window.Sentry && window.Sentry.init) {
      window.Sentry.init({ dsn, release: import.meta.env.VITE_APP_VERSION || undefined });
      console.log('Sentry already available and initialized');
      return;
    }

    const script = document.createElement('script');
    script.src = sentryCdn;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => {
      try {
        const Sentry = window.Sentry;
        if (Sentry && Sentry.init) {
          Sentry.init({ dsn, release: import.meta.env.VITE_APP_VERSION || undefined });
          console.log('Sentry initialized (CDN)');
        } else {
          console.warn('Sentry loaded but init not available');
        }
      } catch (err) {
        console.warn('Error initializing Sentry after load', err);
      }
    };
    script.onerror = (err) => console.warn('Sentry CDN load failed', err);
    document.head.appendChild(script);
  } catch (e) {
    console.warn('Monitoring init failed', e);
  }
}
