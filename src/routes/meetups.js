// ===========================================
// MEETUP ROUTES - /api/v1/meetups
// ===========================================

const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const prisma = require('../config/database');
const { notifyUser } = require('../services/notificationService');
const logger = require('../utils/logger');

// ===========================================
// SEARCH MEETUPS
// ===========================================
router.get('/search',
  query('lat').optional().isFloat({ min: -90, max: 90 }),
  query('lng').optional().isFloat({ min: -180, max: 180 }),
  query('radiusKm').optional().isFloat({ min: 0.1, max: 100 }),
  query('type').optional().isIn(['PLAYDATE', 'GROUP_WALK', 'PET_EVENT', 'TRAINING_SESSION', 'OTHER']),
  validate,
  async (req, res, next) => {
    try {
      const {
        lat, lng, radiusKm = 20,
        type, page = 1, limit = 20
      } = req.query;
      
      const offset = (page - 1) * limit;
      
      if (lat && lng) {
        const radiusMeters = parseFloat(radiusKm) * 1000;
        
        const meetups = await prisma.$queryRaw`
          SELECT 
            m.*,
            ST_X(m.location::geometry) as lng,
            ST_Y(m.location::geometry) as lat,
            ST_Distance(
              m.location,
              ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326)::geography
            ) / 1000 as distance_km,
            u.id as "hostId",
            u.name as "hostName",
            u."avatarUrl" as "hostAvatar",
            (SELECT COUNT(*) FROM "MeetupAttendee" a WHERE a."meetupId" = m.id AND a.status = 'GOING') as "attendeeCount"
          FROM "Meetup" m
          JOIN "User" u ON m."hostId" = u.id
          WHERE m.status = 'UPCOMING'
          AND m."isPublic" = true
          AND m."startTime" > NOW()
          ${type ? prisma.$queryRaw`AND m.type = ${type}::"MeetupType"` : prisma.$queryRaw``}
          AND ST_DWithin(
            m.location,
            ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326)::geography,
            ${radiusMeters}
          )
          ORDER BY m."startTime" ASC
          LIMIT ${parseInt(limit)}
          OFFSET ${offset}
        `;
        
        return res.json({
          meetups: meetups.map(m => ({
            ...m,
            distance_km: parseFloat(m.distance_km).toFixed(2),
            attendeeCount: parseInt(m.attendeeCount),
            host: { id: m.hostId, name: m.hostName, avatarUrl: m.hostAvatar }
          }))
        });
      }
      
      // Non-geospatial query
      const meetups = await prisma.meetup.findMany({
        where: {
          status: 'UPCOMING',
          isPublic: true,
          startTime: { gt: new Date() },
          ...(type && { type })
        },
        include: {
          host: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { attendees: true } }
        },
        orderBy: { startTime: 'asc' },
        skip: offset,
        take: parseInt(limit)
      });
      
      res.json({
        meetups: meetups.map(m => ({
          ...m,
          attendeeCount: m._count.attendees,
          _count: undefined
        }))
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GET MEETUP BY ID
// ===========================================
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const meetups = await prisma.$queryRaw`
      SELECT 
        m.*,
        ST_X(m.location::geometry) as lng,
        ST_Y(m.location::geometry) as lat,
        u.id as "hostId",
        u.name as "hostName",
        u."avatarUrl" as "hostAvatar"
      FROM "Meetup" m
      JOIN "User" u ON m."hostId" = u.id
      WHERE m.id = ${req.params.id}::uuid
    `;
    
    if (meetups.length === 0) {
      return res.status(404).json({ error: 'Meetup not found' });
    }
    
    const meetup = meetups[0];
    
    // Get attendees
    const attendees = await prisma.meetupAttendee.findMany({
      where: { meetupId: req.params.id, status: 'GOING' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        pet: { select: { id: true, name: true, profilePhoto: true, species: true } }
      },
      take: 20
    });
    
    // Check if current user is attending
    let userStatus = null;
    if (req.user) {
      const attendance = await prisma.meetupAttendee.findUnique({
        where: {
          meetupId_userId: { meetupId: req.params.id, userId: req.user.id }
        }
      });
      userStatus = attendance?.status || null;
    }
    
    res.json({
      ...meetup,
      host: { id: meetup.hostId, name: meetup.hostName, avatarUrl: meetup.hostAvatar },
      attendees,
      userStatus,
      isHost: req.user?.id === meetup.hostId
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE MEETUP
// ===========================================
router.post('/',
  authenticate,
  body('title').trim().notEmpty(),
  body('type').isIn(['PLAYDATE', 'GROUP_WALK', 'PET_EVENT', 'TRAINING_SESSION', 'OTHER']),
  body('address').trim().notEmpty(),
  body('lat').isFloat({ min: -90, max: 90 }),
  body('lng').isFloat({ min: -180, max: 180 }),
  body('startTime').isISO8601(),
  validate,
  async (req, res, next) => {
    try {
      const {
        title, description, type, address, venueName,
        lat, lng, startTime, endTime, maxAttendees,
        allowedSpecies, allowedSizes, isPublic, requiresApproval
      } = req.body;
      
      const meetup = await prisma.$queryRaw`
        INSERT INTO "Meetup" (
          id, "hostId", title, description, type,
          location, address, "venueName",
          "startTime", "endTime", "maxAttendees",
          "allowedSpecies", "allowedSizes",
          "isPublic", "requiresApproval", status,
          "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(),
          ${req.user.id}::uuid,
          ${title},
          ${description || null},
          ${type}::"MeetupType",
          ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326)::geography,
          ${address},
          ${venueName || null},
          ${new Date(startTime)},
          ${endTime ? new Date(endTime) : null},
          ${maxAttendees || null},
          ${allowedSpecies || []}::"PetSpecies"[],
          ${allowedSizes || []}::"PetSize"[],
          ${isPublic !== false},
          ${requiresApproval || false},
          'UPCOMING'::"MeetupStatus",
          NOW(),
          NOW()
        )
        RETURNING *, ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat
      `;
      
      const newMeetup = meetup[0];
      
      // Auto-add host as attendee
      await prisma.meetupAttendee.create({
        data: {
          meetupId: newMeetup.id,
          userId: req.user.id,
          status: 'GOING'
        }
      });
      
      logger.info(`Meetup created: ${newMeetup.id} by user ${req.user.id}`);
      res.status(201).json(newMeetup);
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// JOIN MEETUP
// ===========================================
router.post('/:id/join',
  authenticate,
  body('petId').optional().isUUID(),
  body('status').optional().isIn(['GOING', 'MAYBE']),
  validate,
  async (req, res, next) => {
    try {
      const { petId, status = 'GOING' } = req.body;
      const meetupId = req.params.id;
      
      const meetup = await prisma.meetup.findUnique({
        where: { id: meetupId },
        include: { _count: { select: { attendees: true } } }
      });
      
      if (!meetup) {
        return res.status(404).json({ error: 'Meetup not found' });
      }
      
      // Check capacity
      if (meetup.maxAttendees && meetup._count.attendees >= meetup.maxAttendees) {
        return res.status(400).json({ error: 'Meetup is full' });
      }
      
      // Verify pet ownership if provided
      if (petId) {
        const pet = await prisma.pet.findUnique({
          where: { id: petId },
          select: { ownerId: true }
        });
        if (!pet || pet.ownerId !== req.user.id) {
          return res.status(403).json({ error: 'Not your pet' });
        }
      }
      
      const attendance = await prisma.meetupAttendee.upsert({
        where: {
          meetupId_userId: { meetupId, userId: req.user.id }
        },
        update: { status, petId },
        create: { meetupId, userId: req.user.id, petId, status }
      });
      
      // Notify host
      if (meetup.hostId !== req.user.id) {
        const io = req.app.get('io');
        await notifyUser(io, meetup.hostId, {
          type: 'MEETUP_INVITE',
          title: 'New Attendee',
          message: `Someone joined your meetup: ${meetup.title}`,
          data: { meetupId }
        });
      }
      
      res.json(attendance);
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// LEAVE MEETUP
// ===========================================
router.delete('/:id/leave', authenticate, async (req, res, next) => {
  try {
    await prisma.meetupAttendee.delete({
      where: {
        meetupId_userId: { meetupId: req.params.id, userId: req.user.id }
      }
    });
    
    res.json({ message: 'Left meetup' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Not attending this meetup' });
    }
    next(error);
  }
});

// ===========================================
// CANCEL MEETUP
// ===========================================
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const meetup = await prisma.meetup.findUnique({
      where: { id: req.params.id },
      select: { hostId: true, title: true }
    });
    
    if (!meetup) {
      return res.status(404).json({ error: 'Meetup not found' });
    }
    
    if (meetup.hostId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Get attendees to notify
    const attendees = await prisma.meetupAttendee.findMany({
      where: { meetupId: req.params.id },
      select: { userId: true }
    });
    
    await prisma.meetup.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' }
    });
    
    // Notify attendees
    const io = req.app.get('io');
    for (const attendee of attendees) {
      if (attendee.userId !== req.user.id) {
        await notifyUser(io, attendee.userId, {
          type: 'MEETUP_CANCELLED',
          title: 'Meetup Cancelled',
          message: `${meetup.title} has been cancelled`,
          data: { meetupId: req.params.id }
        });
      }
    }
    
    res.json({ message: 'Meetup cancelled' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET MY MEETUPS
// ===========================================
router.get('/user/my-meetups', authenticate, async (req, res, next) => {
  try {
    const [hosted, attending] = await Promise.all([
      prisma.meetup.findMany({
        where: { hostId: req.user.id },
        include: { _count: { select: { attendees: true } } },
        orderBy: { startTime: 'desc' }
      }),
      prisma.meetupAttendee.findMany({
        where: { userId: req.user.id, meetup: { hostId: { not: req.user.id } } },
        include: {
          meetup: {
            include: {
              host: { select: { id: true, name: true, avatarUrl: true } }
            }
          }
        },
        orderBy: { meetup: { startTime: 'desc' } }
      })
    ]);
    
    res.json({
      hosted: hosted.map(m => ({ ...m, attendeeCount: m._count.attendees, _count: undefined })),
      attending: attending.map(a => a.meetup)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
