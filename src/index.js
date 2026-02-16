// ===========================================
// WALDO - Pet Social Network API
// ===========================================

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { authenticateSocket } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const petRoutes = require('./routes/pets');
const lostPetRoutes = require('./routes/lostPets');
const sightingRoutes = require('./routes/sightings');
const meetupRoutes = require('./routes/meetups');
const communityRoutes = require('./routes/community');
const marketplaceRoutes = require('./routes/marketplace');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const paymentRoutes = require('./routes/payments');
const uploadRoutes = require('./routes/uploads');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.set('io', io);

// ===========================================
// MIDDLEWARE
// ===========================================

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.set('trust proxy', 1);
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// ===========================================
// ROUTES
// ===========================================

const API_VERSION = process.env.API_VERSION || 'v1';

app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/users`, userRoutes);
app.use(`/api/${API_VERSION}/pets`, petRoutes);
app.use(`/api/${API_VERSION}/lost-pets`, lostPetRoutes);
app.use(`/api/${API_VERSION}/sightings`, sightingRoutes);
app.use(`/api/${API_VERSION}/meetups`, meetupRoutes);
app.use(`/api/${API_VERSION}/community`, communityRoutes);
app.use(`/api/${API_VERSION}/marketplace`, marketplaceRoutes);
app.use(`/api/${API_VERSION}/messages`, messageRoutes);
app.use(`/api/${API_VERSION}/notifications`, notificationRoutes);
app.use(`/api/${API_VERSION}/payments`, paymentRoutes);
app.use(`/api/${API_VERSION}/uploads`, uploadRoutes);

// Stripe webhooks
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), require('./routes/webhooks/stripe'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: API_VERSION,
    app: 'Waldo API'
  });
});

// ===========================================
// SOCKET.IO
// ===========================================

io.use(authenticateSocket);

const connectedUsers = new Map();

io.on('connection', (socket) => {
  const userId = socket.user?.id;
  
  if (userId) {
    connectedUsers.set(userId, socket.id);
    logger.info(`User connected: ${userId}`);
    socket.join(`user:${userId}`);
  }
  
  // Subscribe to lost pet updates
  socket.on('subscribe:lostPet', (reportId) => {
    socket.join(`lostPet:${reportId}`);
  });
  
  // Subscribe to meetup updates
  socket.on('subscribe:meetup', (meetupId) => {
    socket.join(`meetup:${meetupId}`);
  });
  
  // Subscribe to area for nearby alerts
  socket.on('subscribe:area', ({ lat, lng, radiusKm }) => {
    const cellId = `area:${Math.floor(lat * 10)}_${Math.floor(lng * 10)}`;
    socket.join(cellId);
  });
  
  // Typing indicators
  socket.on('typing:start', ({ conversationId, receiverId }) => {
    io.to(`user:${receiverId}`).emit('typing:start', {
      conversationId,
      userId: socket.user?.id
    });
  });
  
  socket.on('typing:stop', ({ conversationId, receiverId }) => {
    io.to(`user:${receiverId}`).emit('typing:stop', {
      conversationId,
      userId: socket.user?.id
    });
  });
  
  socket.on('disconnect', () => {
    if (userId) {
      connectedUsers.delete(userId);
      logger.info(`User disconnected: ${userId}`);
    }
  });
});

app.set('connectedUsers', connectedUsers);

// ===========================================
// ERROR HANDLING
// ===========================================

app.use(notFoundHandler);
app.use(errorHandler);

// ===========================================
// START SERVER
// ===========================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info(`🐕 Waldo API running on port ${PORT}`);
  logger.info(`📡 WebSocket server ready`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };
