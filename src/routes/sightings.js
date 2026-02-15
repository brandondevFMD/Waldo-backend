// ===========================================
// SIGHTING ROUTES - /api/v1/sightings
// ===========================================

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const prisma = require('../config/database');
const { notifyUser } = require('../services/notificationService');
const logger = require('../utils/logger');

// Report a sighting
router.post('/',
  optionalAuth,
  body('lostPetReportId').isUUID(),
  body('address').notEmpty(),
  body('lat').isFloat({ min: -90, max: 90 }),
  body('lng').isFloat({ min: -180, max: 180 }),
  validate,
  async (req, res, next) => {
    try {
      const { lostPetReportId, address, lat, lng, description, photoUrl, headingDirection } = req.body;
      
      const report = await prisma.lostPetReport.findUnique({
        where: { id: lostPetReportId },
        select: { id: true, ownerId: true, petName: true, status: true }
      });
      
      if (!report) {
        return res.status(404).json({ error: 'Lost pet report not found' });
      }
      
      if (report.status !== 'LOST') {
        return res.status(400).json({ error: 'This pet is no longer listed as lost' });
      }
      
      const sighting = await prisma.$queryRaw`
        INSERT INTO "Sighting" (
          id, "lostPetReportId", "reporterId", location, address,
          description, "photoUrl", "headingDirection", "isVerified", "createdAt"
        ) VALUES (
          gen_random_uuid(),
          ${lostPetReportId}::uuid,
          ${req.user?.id || null}::uuid,
          ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326)::geography,
          ${address},
          ${description || null},
          ${photoUrl || null},
          ${headingDirection || null},
          false,
          NOW()
        )
        RETURNING *, ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat
      `;
      
      // Update reporter stats
      if (req.user) {
        await prisma.user.update({
          where: { id: req.user.id },
          data: { sightingsReported: { increment: 1 } }
        });
      }
      
      // Notify owner
      const io = req.app.get('io');
      await notifyUser(io, report.ownerId, {
        type: 'SIGHTING',
        title: `New sighting of ${report.petName}!`,
        message: `Someone spotted ${report.petName} near ${address}`,
        data: { reportId: lostPetReportId, sightingId: sighting[0].id }
      });
      
      io.to(`lostPet:${lostPetReportId}`).emit('new-sighting', sighting[0]);
      
      res.status(201).json(sighting[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Get nearby sightings
router.get('/nearby',
  async (req, res, next) => {
    try {
      const { lat, lng, radiusKm = 5, limit = 50 } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ error: 'lat and lng required' });
      }
      
      const sightings = await prisma.$queryRaw`
        SELECT 
          s.*, ST_X(s.location::geometry) as lng, ST_Y(s.location::geometry) as lat,
          r."petName", r.species, r.photos
        FROM "Sighting" s
        JOIN "LostPetReport" r ON s."lostPetReportId" = r.id
        WHERE r.status = 'LOST'
        AND ST_DWithin(
          s.location,
          ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326)::geography,
          ${parseFloat(radiusKm) * 1000}
        )
        ORDER BY s."createdAt" DESC
        LIMIT ${parseInt(limit)}
      `;
      
      res.json(sightings);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
