const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const moment = require('moment');
require('dotenv').config(); // Load environment variables from .env

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000; // Use the port from .env, or default to 3000

const connectedUsers = []; // Stores objects with username, status, and socket ID

// Function to log messages
function logMessage(level, message) {
  const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
  console.log(`${timestamp} ${level} ${message}`);
}

app.use(express.static('public'));

io.on('connection', (socket) => {
  logMessage('INFO', `Socket connected with id: ${socket.id}`);

  socket.on('join', (username) => {
    // Check if user is already in the list
    let user = connectedUsers.find((u) => u.name === username);
    if (user) {
      user.status = 'online'; // Update status to online
      user.socketId = socket.id; // Update socket ID
    } else {
      user = { name: username, status: 'online', socketId: socket.id };
      connectedUsers.push(user);
    }
    socket.username = username;

    // Log when a user joins
    logMessage('INFO', `${username} joined the chat`);

    // Send the updated user list to the connected user
    socket.emit('userList', connectedUsers);

    // Notify all users except the newly connected user about the new connection
    socket.broadcast.emit('userJoined', username);
  });

  socket.on('disconnect', () => {
    const user = connectedUsers.find((u) => u.name === socket.username);
    if (user) {
      user.status = 'offline'; // Update status to offline
      logMessage('INFO', `${socket.username} disconnected`);

      // Notify all clients that a user has disconnected
      io.emit('userDisconnected', socket.username);
    }
  });

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
});

server.listen(PORT, () => {
  logMessage('INFO', `Server is listening on port ${PORT}`);
});
