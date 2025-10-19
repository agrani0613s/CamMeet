// server/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' }
});

// Optional: connect to MongoDB if you set MONGO_URI
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB error', err));
}

// Optional Meeting model for scheduling
let Meeting;
if (process.env.MONGO_URI) {
  const meetingSchema = new mongoose.Schema({
    title: String,
    meetingId: String,
    date: Date,
    creator: String,
    createdAt: { type: Date, default: Date.now }
  });
  Meeting = mongoose.model('Meeting', meetingSchema);
}

// In-memory rooms (simple)
const rooms = {}; // { roomId: { host: socketId, participants: { socketId: { name, allowed } } } }

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('create-room', ({ roomId, name }) => {
    rooms[roomId] = rooms[roomId] || { host: socket.id, participants: {} };
    rooms[roomId].host = socket.id;
    rooms[roomId].participants[socket.id] = { name, allowed: true };
    socket.join(roomId);
    socket.emit('room-created', { roomId });
    console.log('Room created:', roomId);
  });

  socket.on('join-room', ({ roomId, name }) => {
    if (!rooms[roomId]) rooms[roomId] = { host: null, participants: {} };
    rooms[roomId].participants[socket.id] = { name, allowed: true };
    socket.join(roomId);

    // inform others in room
    socket.to(roomId).emit('user-joined', { socketId: socket.id, name });

    // send existing participants to the new joiner
    const existing = Object.keys(rooms[roomId].participants)
      .filter(id => id !== socket.id)
      .map(id => ({ socketId: id, name: rooms[roomId].participants[id].name }));

    socket.emit('existing-participants', existing);
    console.log(`${name} joined ${roomId}`);
  });

  // Signaling
  socket.on('offer', ({ to, sdp, from, name }) => {
    io.to(to).emit('offer', { from, sdp, name });
  });

  socket.on('answer', ({ to, sdp, from }) => {
    io.to(to).emit('answer', { from, sdp });
  });

  socket.on('ice-candidate', ({ to, candidate, from }) => {
    io.to(to).emit('ice-candidate', { from, candidate });
  });

  // Chat
  socket.on('chat-message', ({ roomId, message, name }) => {
    io.to(roomId).emit('chat-message', { message, name, time: new Date().toISOString() });
  });

  // Admin actions (optional)
  socket.on('admin-action', ({ roomId, action, targetSocketId }) => {
    if (rooms[roomId] && rooms[roomId].host === socket.id) {
      io.to(roomId).emit('admin-action', { action, targetSocketId });
    }
  });

  // Handle leaving
  socket.on('disconnecting', () => {
    const roomIds = Array.from(socket.rooms).filter(r => r !== socket.id);
    roomIds.forEach(roomId => {
      if (rooms[roomId]) {
        delete rooms[roomId].participants[socket.id];
        socket.to(roomId).emit('user-left', { socketId: socket.id });
      }
    });
  });

  socket.on('end-room', ({ roomId }) => {
  // You can optionally check if socket is host for that room
  // Broadcast to everyone in the room that it ended
  io.to(roomId).emit('room-ended', { roomId });
  // Optionally, clean server-side room state:
  if (rooms[roomId]) delete rooms[roomId];
});


});

// Optional REST endpoints for meetings
app.post('/api/meetings', async (req, res) => {
  if (!Meeting) return res.status(500).json({ error: 'DB not configured' });
  const { title, date, meetingId, creator } = req.body;
  const m = new Meeting({ title, date, meetingId, creator });
  await m.save();
  res.json(m);
});
app.get('/api/meetings', async (req, res) => {
  if (!Meeting) return res.status(500).json({ error: 'DB not configured' });
  const list = await Meeting.find().sort({ date: 1 });
  res.json(list);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
