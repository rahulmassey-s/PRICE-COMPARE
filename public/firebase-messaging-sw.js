importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD5yknpv5YO5yLYBwLG4SUhNVDrLsBPkkA",
  authDomain: "smart-bharat-fa2ee.firebaseapp.com",
  projectId: "smart-bharat-fa2ee",
  messagingSenderId: "852257413675",
  appId: "1:852257413675:web:662070caca66c1252c286e",
});

const messaging = firebase.messaging();

// The onBackgroundMessage handler was removed because it conflicts with the 'push' event listener.
// The 'push' listener provides more robust handling for data-only messages.

// A robust, universal push event handler
self.addEventListener('push', event => {
  console.log('[Service Worker] Push event:', event);
  let data;
  try {
    if (event.data) {
      const rawData = event.data.json();
      console.log('[Service Worker] Raw payload received:', rawData);
      data = rawData.data;
      if (!data) throw new Error("Payload is missing 'data' object.");
    } else {
      throw new Error("Push event contained no data.");
    }
  } catch (e) {
    console.error('[Service Worker] Failed to parse push data:', e);
    data = null;
  }

  // Fallback if data is missing or malformed
  if (!data || !data.title || !data.body) {
    data = {
      title: 'Update',
      body: 'You have a new notification.',
      icon: '/icons/icon-192x192.png',
      link: '/'
    };
    console.warn('[Service Worker] Using fallback notification data:', data);
  }

  const title = data.title || 'New Notification';
  const options = {
    body: data.body || 'Something new happened!',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-72x72.png',
    image: data.imageUrl ? data.imageUrl : undefined,
    data: {
      url: data.link || '/'
    },
    actions: []
  };

  try {
    if (data.actions && typeof data.actions === 'string' && data.actions !== '[]') {
      const parsedActions = JSON.parse(data.actions);
      if (Array.isArray(parsedActions) && parsedActions.length > 0) {
        options.actions = parsedActions.map(a => ({
          action: a.link,
          title: a.title
        }));
      }
    }
  } catch (e) {
    console.error('[Service Worker] Could not parse notification actions.', e);
  }

  console.log('[Service Worker] Showing notification with title:', title, 'and options:', options);

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => { console.log('[Service Worker] showNotification promise resolved.'); })
      .catch(err => console.error('[Service Worker] showNotification promise rejected:', err))
  );
});

self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click:', event);
  const clickedNotification = event.notification;
  clickedNotification.close();
  const urlToOpen = event.action || clickedNotification.data.url;
  console.log('[Service Worker] Opening window:', urlToOpen);
  const promiseChain = clients.openWindow(urlToOpen);
  event.waitUntil(promiseChain);
});
 