// ===========================================
// NOTIFICATION ROUTES - /api/v1/notifications
// ===========================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getUserNotifications, markAsRead, markAllAsRead } = require('../services/notificationService');

// Get notifications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const result = await getUserNotifications(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
      unreadOnly: unreadOnly === 'true'
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Mark notification as read
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const notification = await markAsRead(req.params.id, req.user.id);
    res.json(notification);
  } catch (error) {
    if (error.message === 'Notification not found') {
      return res.status(404).json({ error: 'Notification not found' });
    }
    next(error);
  }
});

// Mark all as read
router.post('/read-all', authenticate, async (req, res, next) => {
  try {
    await markAllAsRead(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
