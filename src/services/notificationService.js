// ===========================================
// NOTIFICATION SERVICE
// ===========================================

const prisma = require('../config/database');
const firebase = require('../config/firebase');
const logger = require('../utils/logger');

// ===========================================
// NOTIFY SINGLE USER
// ===========================================
exports.notifyUser = async (io, userId, notification) => {
  try {
    const { type, title, message, data } = notification;
    
    // Save to database
    const dbNotification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data
      }
    });
    
    // Send via Socket.io (real-time)
    io.to(`user:${userId}`).emit('notification', {
      id: dbNotification.id,
      type,
      title,
      message,
      data,
      createdAt: dbNotification.createdAt
    });
    
    // Send push notification via Firebase
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmTokens: true }
    });
    
    if (user?.fcmTokens?.length > 0) {
      const pushMessage = {
        notification: {
          title,
          body: message
        },
        data: {
          type,
          notificationId: dbNotification.id,
          ...Object.fromEntries(
            Object.entries(data || {}).map(([k, v]) => [k, String(v)])
          )
        },
        tokens: user.fcmTokens
      };
      
      try {
        const response = await firebase.messaging().sendEachForMulticast(pushMessage);
        
        // Remove invalid tokens
        if (response.failureCount > 0) {
          const invalidTokens = [];
          response.responses.forEach((resp, idx) => {
            if (!resp.success && resp.error?.code === 'messaging/invalid-registration-token') {
              invalidTokens.push(user.fcmTokens[idx]);
            }
          });
          
          if (invalidTokens.length > 0) {
            await prisma.user.update({
              where: { id: userId },
              data: {
                fcmTokens: user.fcmTokens.filter(t => !invalidTokens.includes(t))
              }
            });
          }
        }
        
        logger.debug(`Push notification sent to ${response.successCount} devices`);
      } catch (pushError) {
        logger.error('Push notification error:', pushError);
      }
    }
    
    return dbNotification;
  } catch (error) {
    logger.error('Notify user error:', error);
    throw error;
  }
};

// ===========================================
// NOTIFY MULTIPLE USERS
// ===========================================
exports.notifyUsers = async (io, userIds, notification) => {
  const results = await Promise.allSettled(
    userIds.map(userId => exports.notifyUser(io, userId, notification))
  );
  
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  logger.info(`Batch notification: ${succeeded} succeeded, ${failed} failed`);
  
  return { succeeded, failed };
};

// ===========================================
// NOTIFY GEOGRAPHIC AREA
// ===========================================
exports.notifyArea = async (io, options) => {
  const { lat, lng, radiusKm, event, data, excludeUserId } = options;
  
  // Emit to area room (clients subscribe based on their location)
  const cellId = `area:${Math.floor(lat * 10)}_${Math.floor(lng * 10)}`;
  io.to(cellId).emit(event, data);
  
  logger.debug(`Area notification sent to ${cellId}`, { event });
};

// ===========================================
// MARK NOTIFICATION AS READ
// ===========================================
exports.markAsRead = async (notificationId, userId) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId }
  });
  
  if (!notification || notification.userId !== userId) {
    throw new Error('Notification not found');
  }
  
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() }
  });
};

// ===========================================
// MARK ALL AS READ
// ===========================================
exports.markAllAsRead = async (userId) => {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() }
  });
};

// ===========================================
// GET USER NOTIFICATIONS
// ===========================================
exports.getUserNotifications = async (userId, options = {}) => {
  const { page = 1, limit = 20, unreadOnly = false } = options;
  
  const where = { userId };
  if (unreadOnly) {
    where.isRead = false;
  }
  
  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } })
  ]);
  
  return {
    notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};
