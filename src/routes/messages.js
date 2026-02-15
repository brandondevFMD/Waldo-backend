// ===========================================
// MESSAGE ROUTES - /api/v1/messages
// ===========================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const prisma = require('../config/database');
const { notifyUser } = require('../services/notificationService');

// Get conversations
router.get('/conversations', authenticate, async (req, res, next) => {
  try {
    // Get unique conversations
    const conversations = await prisma.$queryRaw`
      SELECT DISTINCT ON (other_user_id)
        CASE 
          WHEN m."senderId" = ${req.user.id}::uuid THEN m."receiverId"
          ELSE m."senderId"
        END as other_user_id,
        m.id as last_message_id,
        m.content as last_message,
        m."createdAt" as last_message_at,
        m."isRead",
        u.name as other_user_name,
        u."avatarUrl" as other_user_avatar,
        d.id as dog_id,
        d.name as dog_name
      FROM "Message" m
      JOIN "User" u ON u.id = CASE 
        WHEN m."senderId" = ${req.user.id}::uuid THEN m."receiverId"
        ELSE m."senderId"
      END
      LEFT JOIN "LostDog" d ON d.id = m."lostDogId"
      WHERE m."senderId" = ${req.user.id}::uuid OR m."receiverId" = ${req.user.id}::uuid
      ORDER BY other_user_id, m."createdAt" DESC
    `;
    
    res.json(conversations);
  } catch (error) {
    next(error);
  }
});

// Get messages with a user
router.get('/with/:userId', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.user.id, receiverId: userId },
          { senderId: userId, receiverId: req.user.id }
        ]
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });
    
    // Mark as read
    await prisma.message.updateMany({
      where: {
        senderId: userId,
        receiverId: req.user.id,
        isRead: false
      },
      data: { isRead: true, readAt: new Date() }
    });
    
    res.json(messages.reverse());
  } catch (error) {
    next(error);
  }
});

// Send message
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { receiverId, content, lostDogId } = req.body;
    
    if (receiverId === req.user.id) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }
    
    const message = await prisma.message.create({
      data: {
        senderId: req.user.id,
        receiverId,
        content,
        lostDogId
      }
    });
    
    // Notify receiver
    const io = req.app.get('io');
    io.to(`user:${receiverId}`).emit('new-message', {
      ...message,
      sender: { id: req.user.id, name: req.user.name }
    });
    
    await notifyUser(io, receiverId, {
      type: 'MESSAGE',
      title: `New message from ${req.user.name}`,
      message: content.substring(0, 100),
      data: { senderId: req.user.id }
    });
    
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

// Get unread count
router.get('/unread-count', authenticate, async (req, res, next) => {
  try {
    const count = await prisma.message.count({
      where: { receiverId: req.user.id, isRead: false }
    });
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
