const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const webpush = require('web-push');
const path = require('path');
const moment = require('moment');
const { log } = require('console');
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
      logMessage('INFO', `${username} joined the chat`);
    } else {
      // Update the user's socket ID and status
      user.socketId = socket.id;
      user.status = 'online';
      const time = moment().format('YYYY-MM-DD HH:mm:ss');
      // Notify others that the user rejoined
      io.emit('userRejoined', { username, time });
      logMessage('INFO', `${username} rejoined the chat`);
    }

    // Notify the user of the current user list
    socket.emit('userList', connectedUsers);

    // Broadcast to others that a user has joined
    socket.broadcast.emit('userJoined', {
      username,
      time: new Date().toISOString(),
    });
  });

  // Handle the 'subscribe' event for push notifications
  socket.on('subscribe', (data) => {
    // Find the user and add their subscription
    let user = connectedUsers.find((u) => u.name === data.username);
    if (user) {
      user.subscription = data.subscription;
      const time = moment().format('YYYY-MM-DD HH:mm:ss');
      user.status = 'offline'; // Update status to offline
      logMessage('INFO', `${socket.username} disconnected`);

      // Notify all clients that a user has disconnected
      io.emit('userDisconnected', { username: socket.username, time });
    }
  });

  // Handle private messages
  socket.on('privateMessage', ({ time, receiver, message }) => {
    const sender = socket.username;
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
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logMessage('INFO', `Server is listening on port ${PORT}`);
});
