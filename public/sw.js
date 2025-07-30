// This is the service worker that will handle incoming push notifications.
console.log('[Service Worker] File loaded.');

self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    console.error('[Service Worker] Failed to parse push data:', e);
    return;
  }
  // Strictly validate image URL
  let image = undefined;
  if (data.image && typeof data.image === 'string' && data.image.startsWith('https://')) {
    image = data.image;
  }
  // Use actions array if present and valid
  let actions = Array.isArray(data.actions) ? data.actions.filter(a => a && a.action && a.title) : undefined;
  const options = {
    body: data.body,
    icon: data.icon,
    image: image,
    actions: actions,
    data: {
      url: data.data?.url,
      actions: actions
    }
  };
  console.log('[Service Worker] Notification options:', options);
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action) {
    // Find the action by event.action and open its URL
    const actionObj = event.notification.data?.actions?.find(a => a.action === event.action);
    if (actionObj && actionObj.url) {
      event.waitUntil(clients.openWindow(actionObj.url));
      return;
    }
  }
  // Default click
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
}); 