// ===========================================
// AUTHENTICATION MIDDLEWARE
// ===========================================

const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const logger = require('../utils/logger');

// ===========================================
// AUTHENTICATE - Required auth
// ===========================================
exports.authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        isVerified: true,
        isActive: true,
        stripeCustomerId: true,
        stripeAccountId: true
      }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// ===========================================
// OPTIONAL AUTH - Auth optional, but set user if present
// ===========================================
exports.optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          isVerified: true,
          isActive: true
        }
      });
      
      if (user && user.isActive) {
        req.user = user;
      }
    } catch (err) {
      // Token invalid, continue without auth
    }
    
    next();
  } catch (error) {
    next();
  }
};

// ===========================================
// AUTHENTICATE SOCKET
// ===========================================
exports.authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    
    if (!token) {
      // Allow connection without auth (for public feeds)
      return next();
    }
    
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true }
    });
    
    if (user) {
      socket.user = user;
    }
    
    next();
  } catch (error) {
    // Allow connection but without user context
    next();
  }
};

// ===========================================
// REQUIRE VERIFIED EMAIL
// ===========================================
exports.requireVerified = (req, res, next) => {
  if (!req.user?.isVerified) {
    return res.status(403).json({ 
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }
  next();
};
