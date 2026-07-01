/**
 * Requests native browser notification permission.
 * @returns {Promise<boolean>} True if granted, false otherwise.
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notification');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
}

/**
 * Sends a native browser notification if permissions are granted.
 * Only sends if the document is not visible/focused to avoid spamming the user when they are looking at the app.
 * @param {string} title The title of the notification
 * @param {NotificationOptions} options Optional configuration for the notification
 * @param {boolean} force Force send even if document is visible
 */
export function sendNativeNotification(title, options = {}, force = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  if (!force && document.visibilityState === 'visible' && document.hasFocus()) {
    // App is currently focused, do not send native notification
    return;
  }

  try {
    const defaultOptions = {
      icon: '/assets/favicon.png',
      badge: '/assets/favicon.png',
      vibrate: [200, 100, 200],
      data: {
        url: window.location.origin,
      }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          registration.showNotification(title, mergedOptions);
        })
        .catch((error) => {
          console.warn('Service worker not ready for notification, using fallback:', error);
          const notif = new Notification(title, mergedOptions);
          notif.onclick = function(event) {
            event.preventDefault();
            window.focus();
            this.close();
          };
        });
    } else {
      const notif = new Notification(title, mergedOptions);
      notif.onclick = function(event) {
        event.preventDefault();
        window.focus();
        this.close();
      };
    }
  } catch (error) {
    console.error('Failed to send native notification:', error);
  }
}
