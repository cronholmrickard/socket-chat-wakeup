self.addEventListener('push', function (event) {
  const data = event.data.json();

  const options = {
    body: data.body,
    icon: 'icon.png', // Replace with your app icon
    badge: 'badge.png', // Replace with your badge icon
    data: {
      url: data.url, // The URL you want to focus or open
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close(); // Close the notification

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then(function (clientList) {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus(); // Focus the existing tab
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url); // Open a new tab if no existing tab found
        }
      }),
  );
});
