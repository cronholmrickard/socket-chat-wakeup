self.addEventListener('push', function (event) {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: 'icon.png', // Path to an icon image
    badge: 'badge.png', // Path to a badge image
    data: {
      url: data.url, // URL to navigate to when notification is clicked
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // If the chat app is open, focus it
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new tab to the chat app
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    }),
  );
});
