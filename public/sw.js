// public/sw.js

self.addEventListener("push", (event) => {
  console.log("[Service Worker] Push Received.");

  // Default payload if something goes wrong
  let payload = {
    title: "New Notification",
    body: "You have a new message from SBHS.",
    icon: "/icons/icon-192x192.png", // Default icon
    image: null,
    actions: []
  };

  try {
    // Attempt to parse the data from the push event
    if (event.data) {
      const data = event.data.json();
      payload = { ...payload, ...data }; // Merge received data with defaults
    }
  } catch (e) {
    console.error("[Service Worker] Error parsing push data:", e);
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: "/icons/icon-192x192.png", // Badge is for Android status bar
    image: payload.image, // Large image shown in the notification
    actions: payload.actions, // e.g., [{ action: 'explore', title: 'See More' }]
    data: {
        // You can add custom data to handle clicks
        url: payload.url || '/', // URL to open on click
    }
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});


self.addEventListener("notificationclick", (event) => {
  console.log("[Service Worker] Notification click Received.");

  // Close the notification
  event.notification.close();

  // Handle the action
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientsArr) => {
      // If a window is already open, focus it
      const hadWindowToFocus = clientsArr.some((windowClient) =>
        windowClient.url === urlToOpen ? (windowClient.focus(), true) : false
      );

      // Otherwise, open a new window
      if (!hadWindowToFocus) {
        clients.openWindow(urlToOpen).then((windowClient) =>
          windowClient ? windowClient.focus() : null
        );
      }
    })
  );
}); 