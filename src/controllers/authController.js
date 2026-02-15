// ===========================================
// AUTH CONTROLLER
// ===========================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/database');
const firebase = require('../config/firebase');
const { sendEmail } = require('../services/emailService');
const logger = require('../utils/logger');

// Generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  
  const refreshToken = jwt.sign(
    { userId, tokenId: uuidv4() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
  
  return { accessToken, refreshToken };
};

// ===========================================
// REGISTER
// ===========================================
exports.register = async (req, res, next) => {
  try {
    const { email, password, name, phone } = req.body;
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone,
        isVerified: false
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isVerified: true,
        createdAt: true
      }
    });
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);
    
    // Store refresh token
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent: req.get('user-agent'),
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });
    
    // Send verification email
    const verifyToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    await sendEmail({
      to: email,
      subject: 'Verify your Find My Dog account',
      template: 'verify-email',
      data: { name, verifyUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}` }
    });
    
    logger.info(`New user registered: ${email}`);
    
    res.status(201).json({
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
};

// ===========================================
// LOGIN
// ===========================================
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);
    
    // Store refresh token
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent: req.get('user-agent'),
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    
    logger.info(`User logged in: ${email}`);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
        dogsFound: user.dogsFound,
        sightingsReported: user.sightingsReported,
        totalEarned: user.totalEarned
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
};

// ===========================================
// FIREBASE AUTH (Google, Apple)
// ===========================================
exports.firebaseAuth = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    
    // Verify Firebase token
    const decodedToken = await firebase.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;
    
    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          avatarUrl: picture,
          isVerified: true // Firebase already verified
        }
      });
      logger.info(`New user created via Firebase: ${email}`);
    }
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);
    
    // Store refresh token
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent: req.get('user-agent'),
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Firebase auth error:', error);
    res.status(401).json({ error: 'Invalid Firebase token' });
  }
};

// ===========================================
// REFRESH TOKEN
// ===========================================
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }
    
    // Verify refresh token
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    // Check if session exists
    const session = await prisma.session.findUnique({
      where: { refreshToken }
    });
    
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }
    
    // Generate new tokens
    const tokens = generateTokens(payload.userId);
    
    // Update session with new refresh token
    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    
    res.json(tokens);
  } catch (error) {
    next(error);
  }
};

// ===========================================
// LOGOUT
// ===========================================
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      await prisma.session.deleteMany({
        where: { refreshToken }
      });
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// ===========================================
// GET CURRENT USER
// ===========================================
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarUrl: true,
        isVerified: true,
        dogsFound: true,
        sightingsReported: true,
        totalEarned: true,
        createdAt: true,
        stripeAccountId: true
      }
    });
    
    res.json(user);
  } catch (error) {
    next(error);
  }
};

// ===========================================
// FORGOT PASSWORD
// ===========================================
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email } });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If an account exists, a reset link has been sent' });
    }
    
    const resetToken = jwt.sign(
      { userId: user.id, type: 'reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    await sendEmail({
      to: email,
      subject: 'Reset your Find My Dog password',
      template: 'reset-password',
      data: {
        name: user.name,
        resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
      }
    });
    
    res.json({ message: 'If an account exists, a reset link has been sent' });
  } catch (error) {
    next(error);
  }
};

// ===========================================
// RESET PASSWORD
// ===========================================
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.type !== 'reset') throw new Error();
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    
    await prisma.user.update({
      where: { id: payload.userId },
      data: { passwordHash }
    });
    
    // Invalidate all sessions
    await prisma.session.deleteMany({
      where: { userId: payload.userId }
    });
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
};

// ===========================================
// VERIFY EMAIL
// ===========================================
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    
    await prisma.user.update({
      where: { id: payload.userId },
      data: { isVerified: true }
    });
    
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
};

// ===========================================
// UPDATE PASSWORD
// ===========================================
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    const passwordHash = await bcrypt.hash(newPassword, 12);
    
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash }
    });
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};

// ===========================================
// UPDATE FCM TOKEN
// ===========================================
exports.updateFcmToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { fcmTokens: true }
    });
    
    // Add token if not already present
    if (!user.fcmTokens.includes(token)) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          fcmTokens: [...user.fcmTokens, token]
        }
      });
    }
    
    res.json({ message: 'FCM token updated' });
  } catch (error) {
    next(error);
  }
};
