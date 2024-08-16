const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const webpush = require('web-push');
const path = require('path');
const moment = require('moment');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const connectedUsers = []; // Stores users and their socket IDs

// Set up VAPID keys for web push notifications
webpush.setVapidDetails(
  'mailto:your-email@example.com', // Replace with your email
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

// Function to log messages
function logMessage(level, message) {
  const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
  console.log(`${timestamp} ${level} ${message}`);
}

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Handle Socket.IO connections
io.on('connection', (socket) => {
  logMessage('INFO', `Socket connected with id: ${socket.id}`);

  // Handle the 'join' event
  socket.on('join', (username) => {
    logMessage('INFO', `${username} joined the chat`);

    // Save the username on the socket object
    socket.username = username;

    // Check if user already exists
    let user = connectedUsers.find((u) => u.name === username);
    if (!user) {
      // Add new user to the list
      user = { name: username, socketId: socket.id, status: 'online' };
      connectedUsers.push(user);

      // Notify others that a new user joined
      const time = moment().format('YYYY-MM-DD HH:mm:ss');
      io.emit('userJoined', { username, time });
    } else {
      // Update the user's socket ID and status
      user.socketId = socket.id;
      user.status = 'online';
      const time = moment().format('YYYY-MM-DD HH:mm:ss');
      // Notify others that the user rejoined
      io.emit('userRejoined', { username, time });
    }

    // Notify the user of the current user list
    socket.emit('userList', connectedUsers);
  });

  // Handle the 'subscribe' event for push notifications
  socket.on('subscribe', (data) => {
    logMessage('INFO', `Subscribe event received from ${data.username}`);

    // Find the user and add their subscription
    let user = connectedUsers.find((u) => u.name === data.username);
    if (user) {
      user.subscription = data.subscription;
    }
  });

  // Handle private messages
  socket.on('privateMessage', ({ time, receiver, message }) => {
    const sender = socket.username; // Retrieve the username from the socket object
    const receiverUser = connectedUsers.find((u) => u.name === receiver);

    if (receiverUser && receiverUser.socketId) {
      // Send the message to the receiver
      io.to(receiverUser.socketId).emit('privateMessage', {
        time,
        sender,
        receiver,
        message,
      });
      // Send the message back to the sender
      socket.emit('privateMessage', { time, sender, receiver, message });

      // Log the private message
      logMessage('INFO', `${time} ${sender} > ${receiver}: ${message}`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    logMessage('INFO', `Socket disconnected with id: ${socket.id}`);

    const user = connectedUsers.find((u) => u.socketId === socket.id);
    if (user) {
      user.status = 'offline';
      logMessage('INFO', `${user.name} disconnected`);

      // Notify others that a user has disconnected
      io.emit('userDisconnected', {
        username: user.name,
        time: new Date().toISOString(),
      });
    }
  });

  // Handle 'pokeUser' event to send a push notification
  socket.on('pokeUser', ({ username, url }) => {
    const user = connectedUsers.find((u) => u.name === username);
    console.log(`poking ${url}`);
    if (user && user.status === 'offline' && user.subscription) {
      const payload = JSON.stringify({
        title: 'Come back to the chat!',
        body: `${socket.username} wants you to return.`,
        url,
      });

      webpush
        .sendNotification(user.subscription, payload)
        .then(() => logMessage('INFO', `Push notification sent to ${username}`))
        .catch((error) =>
          logMessage(
            'ERROR',
            `Error sending push notification to ${username}: ${error}`,
          ),
        );
    } else {
      logMessage(
        'INFO',
        `User ${username} is either online or has no subscription.`,
      );
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logMessage('INFO', `Server is listening on port ${PORT}`);
});
