// ===========================================
// AUTH ROUTES - /api/v1/auth
// ===========================================

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number required')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required')
];

// ===========================================
// PUBLIC ROUTES
// ===========================================

// Register new user
router.post('/register', registerValidation, validate, authController.register);

// Login with email/password
router.post('/login', loginValidation, validate, authController.login);

// Login/register with Firebase (Google, Apple)
router.post('/firebase', authController.firebaseAuth);

// Refresh access token
router.post('/refresh', authController.refreshToken);

// Request password reset
router.post('/forgot-password', 
  body('email').isEmail().normalizeEmail(),
  validate,
  authController.forgotPassword
);

// Reset password with token
router.post('/reset-password',
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }),
  validate,
  authController.resetPassword
);

// Verify email
router.get('/verify-email/:token', authController.verifyEmail);

// ===========================================
// PROTECTED ROUTES
// ===========================================

// Logout (invalidate refresh token)
router.post('/logout', authenticate, authController.logout);

// Get current user
router.get('/me', authenticate, authController.getCurrentUser);

// Update password
router.put('/password',
  authenticate,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
  validate,
  authController.updatePassword
);

// Update FCM token for push notifications
router.post('/fcm-token',
  authenticate,
  body('token').notEmpty(),
  validate,
  authController.updateFcmToken
);

module.exports = router;
