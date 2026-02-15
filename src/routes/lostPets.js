// ===========================================
// LOST PET ROUTES - /api/v1/lost-pets
// ===========================================

const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const prisma = require('../config/database');
const { notifyUser, notifyArea } = require('../services/notificationService');
const logger = require('../utils/logger');

// ===========================================
// SEARCH LOST PETS
// ===========================================
router.get('/search',
  query('lat').optional().isFloat({ min: -90, max: 90 }),
  query('lng').optional().isFloat({ min: -180, max: 180 }),
  query('radiusKm').optional().isFloat({ min: 0.1, max: 100 }),
  query('species').optional().isIn(['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER']),
  query('hasReward').optional().isBoolean(),
  validate,
  async (req, res, next) => {
    try {
      const {
        lat, lng, radiusKm = 10,
        status = 'LOST', species, hasReward,
        page = 1, limit = 20
      } = req.query;
      
      const offset = (page - 1) * limit;
      
      if (lat && lng) {
        const radiusMeters = parseFloat(radiusKm) * 1000;
        
        const reports = await prisma.$queryRaw`
          SELECT 
            r.*,
            ST_X(r."lastSeenLocation"::geometry) as lng,
            ST_Y(r."lastSeenLocation"::geometry) as lat,
            ST_Distance(
              r."lastSeenLocation",
              ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326)::geography
            ) / 1000 as distance_km,
            u.id as "ownerId",
            u.name as "ownerName",
            u."avatarUrl" as "ownerAvatar",
            (SELECT COUNT(*) FROM "Sighting" s WHERE s."lostPetReportId" = r.id) as "sightingCount"
          FROM "LostPetReport" r
          JOIN "User" u ON r."ownerId" = u.id
          WHERE r.status = ${status}
          ${species ? prisma.$queryRaw`AND r.species = ${species}::"PetSpecies"` : prisma.$queryRaw``}
          ${hasReward === 'true' ? prisma.$queryRaw`AND r."rewardAmount" > 0 AND r."rewardEscrowed" = true` : prisma.$queryRaw``}
          AND ST_DWithin(
            r."lastSeenLocation",
            ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326)::geography,
            ${radiusMeters}
          )
          ORDER BY distance_km ASC, r."createdAt" DESC
          LIMIT ${parseInt(limit)}
          OFFSET ${offset}
        `;
        
        return res.json({
          reports: reports.map(r => ({
            ...r,
            rewardAmount: r.rewardAmount ? parseFloat(r.rewardAmount) : null,
            distance_km: parseFloat(r.distance_km).toFixed(2),
            sightingCount: parseInt(r.sightingCount),
            owner: { id: r.ownerId, name: r.ownerName, avatarUrl: r.ownerAvatar }
          }))
        });
      }
      
      // Non-geospatial query
      let where = { status };
      if (species) where.species = species;
      if (hasReward === 'true') {
        where.rewardAmount = { gt: 0 };
        where.rewardEscrowed = true;
      }
      
      const reports = await prisma.lostPetReport.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { sightings: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: parseInt(limit)
      });
      
      res.json({
        reports: reports.map(r => ({
          ...r,
          sightingCount: r._count.sightings,
          _count: undefined
        }))
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GET LOST PET BY ID
// ===========================================
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const reports = await prisma.$queryRaw`
      SELECT 
        r.*,
        ST_X(r."lastSeenLocation"::geometry) as lng,
        ST_Y(r."lastSeenLocation"::geometry) as lat,
        u.id as "ownerId",
        u.name as "ownerName",
        u.phone as "ownerPhone",
        u."avatarUrl" as "ownerAvatar"
      FROM "LostPetReport" r
      JOIN "User" u ON r."ownerId" = u.id
      WHERE r.id = ${req.params.id}::uuid
    `;
    
    if (reports.length === 0) {
      return res.status(404).json({ error: 'Lost pet report not found' });
    }
    
    const report = reports[0];
    
    // Increment view count
    await prisma.lostPetReport.update({
      where: { id: req.params.id },
      data: { viewCount: { increment: 1 } }
    });
    
    // Get sightings
    const sightings = await prisma.$queryRaw`
      SELECT 
        s.*,
        ST_X(s.location::geometry) as lng,
        ST_Y(s.location::geometry) as lat,
        u.name as "reporterName",
        u."avatarUrl" as "reporterAvatar"
      FROM "Sighting" s
      LEFT JOIN "User" u ON s."reporterId" = u.id
      WHERE s."lostPetReportId" = ${req.params.id}::uuid
      ORDER BY s."createdAt" DESC
      LIMIT 10
    `;
    
    res.json({
      ...report,
      rewardAmount: report.rewardAmount ? parseFloat(report.rewardAmount) : null,
      owner: {
        id: report.ownerId,
        name: report.ownerName,
        phone: req.user ? report.ownerPhone : null,
        avatarUrl: report.ownerAvatar
      },
      sightings,
      isOwner: req.user?.id === report.ownerId
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE LOST PET REPORT
// ===========================================
router.post('/',
  authenticate,
  body('petName').trim().notEmpty(),
  body('species').isIn(['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER']),
  body('description').trim().notEmpty(),
  body('lastSeenAddress').trim().notEmpty(),
  body('lastSeenLat').isFloat({ min: -90, max: 90 }),
  body('lastSeenLng').isFloat({ min: -180, max: 180 }),
  body('lastSeenDate').isISO8601(),
  validate,
  async (req, res, next) => {
    try {
      const {
        petId, petName, species, breed, color, size, gender,
        description, distinguishingFeatures, collarInfo, microchipId,
        photos, lastSeenAddress, lastSeenLat, lastSeenLng, lastSeenDate,
        rewardAmount, contactPhone, contactEmail
      } = req.body;
      
      const report = await prisma.$queryRaw`
        INSERT INTO "LostPetReport" (
          id, "ownerId", "petId", "petName", species, breed, color, size, gender,
          description, "distinguishingFeatures", "collarInfo", "microchipId",
          photos, "lastSeenLocation", "lastSeenAddress", "lastSeenDate",
          "rewardAmount", "contactPhone", "contactEmail", status, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(),
          ${req.user.id}::uuid,
          ${petId || null}::uuid,
          ${petName},
          ${species}::"PetSpecies",
          ${breed || null},
          ${color || null},
          ${size || null}::"PetSize",
          ${gender || null}::"PetGender",
          ${description},
          ${distinguishingFeatures || null},
          ${collarInfo || null},
          ${microchipId || null},
          ${photos || []}::text[],
          ST_SetSRID(ST_MakePoint(${parseFloat(lastSeenLng)}, ${parseFloat(lastSeenLat)}), 4326)::geography,
          ${lastSeenAddress},
          ${new Date(lastSeenDate)},
          ${rewardAmount ? parseFloat(rewardAmount) : null},
          ${contactPhone || null},
          ${contactEmail || null},
          'LOST'::"LostPetStatus",
          NOW(),
          NOW()
        )
        RETURNING *, ST_X("lastSeenLocation"::geometry) as lng, ST_Y("lastSeenLocation"::geometry) as lat
      `;
      
      const newReport = report[0];
      
      // Notify area
      const io = req.app.get('io');
      await notifyArea(io, {
        lat: parseFloat(lastSeenLat),
        lng: parseFloat(lastSeenLng),
        radiusKm: 5,
        event: 'new-lost-pet',
        data: {
          reportId: newReport.id,
          petName: newReport.petName,
          species: newReport.species,
          photo: newReport.photos?.[0],
          address: newReport.lastSeenAddress,
          rewardAmount: newReport.rewardAmount
        }
      });
      
      logger.info(`Lost pet report created: ${newReport.id}`);
      res.status(201).json(newReport);
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// UPDATE STATUS
// ===========================================
router.patch('/:id/status',
  authenticate,
  body('status').isIn(['LOST', 'FOUND', 'REUNITED', 'CLOSED']),
  validate,
  async (req, res, next) => {
    try {
      const report = await prisma.lostPetReport.findUnique({
        where: { id: req.params.id },
        select: { ownerId: true }
      });
      
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      
      if (report.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const updated = await prisma.lostPetReport.update({
        where: { id: req.params.id },
        data: {
          status: req.body.status,
          foundDate: ['FOUND', 'REUNITED'].includes(req.body.status) ? new Date() : null
        }
      });
      
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GET MY REPORTS
// ===========================================
router.get('/user/my-reports', authenticate, async (req, res, next) => {
  try {
    const reports = await prisma.lostPetReport.findMany({
      where: { ownerId: req.user.id },
      include: {
        _count: { select: { sightings: true, rewardClaims: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(reports.map(r => ({
      ...r,
      sightingCount: r._count.sightings,
      claimCount: r._count.rewardClaims,
      _count: undefined
    })));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
