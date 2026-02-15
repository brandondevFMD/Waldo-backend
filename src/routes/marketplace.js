// ===========================================
// MARKETPLACE ROUTES - /api/v1/marketplace
// ===========================================

const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { validate } = require('../middleware/validate');
const prisma = require('../config/database');

// ===========================================
// SEARCH LISTINGS
// ===========================================
router.get('/listings',
  query('species').optional().isIn(['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER']),
  query('businessType').optional().isIn([
    'PET_STORE', 'SHELTER', 'RESCUE', 'BREEDER', 'NONPROFIT', 'OTHER'
  ]),
  validate,
  async (req, res, next) => {
    try {
      const { species, businessType, isFree, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      
      let where = {
        status: 'AVAILABLE',
        business: { isVerified: true, isActive: true }
      };
      
      if (species) where.species = species;
      if (businessType) where.business = { ...where.business, type: businessType };
      if (isFree === 'true') where.isFree = true;
      
      const [listings, total] = await Promise.all([
        prisma.marketplaceListing.findMany({
          where,
          include: {
            business: {
              select: { id: true, name: true, type: true, logoUrl: true, address: true, isVerified: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: parseInt(limit)
        }),
        prisma.marketplaceListing.count({ where })
      ]);
      
      res.json({
        listings,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GET LISTING BY ID
// ===========================================
router.get('/listings/:id', async (req, res, next) => {
  try {
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: req.params.id },
      include: {
        business: {
          select: {
            id: true, name: true, type: true, description: true,
            email: true, phone: true, website: true, address: true,
            logoUrl: true, photos: true, isVerified: true,
            operatingHours: true, rating: true, reviewsCount: true
          }
        }
      }
    });
    
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    await prisma.marketplaceListing.update({
      where: { id: req.params.id },
      data: { viewCount: { increment: 1 } }
    });
    
    res.json(listing);
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET BUSINESSES
// ===========================================
router.get('/businesses',
  query('type').optional().isIn([
    'PET_STORE', 'SHELTER', 'RESCUE', 'BREEDER', 'VETERINARY',
    'GROOMING', 'TRAINING', 'NONPROFIT', 'OTHER'
  ]),
  validate,
  async (req, res, next) => {
    try {
      const { type, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      
      let where = { isVerified: true, isActive: true };
      if (type) where.type = type;
      
      const [businesses, total] = await Promise.all([
        prisma.business.findMany({
          where,
          select: {
            id: true, name: true, type: true, description: true,
            address: true, logoUrl: true, isVerified: true,
            rating: true, reviewsCount: true, listingsCount: true
          },
          orderBy: { listingsCount: 'desc' },
          skip: offset,
          take: parseInt(limit)
        }),
        prisma.business.count({ where })
      ]);
      
      res.json({
        businesses,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GET BUSINESS BY ID
// ===========================================
router.get('/businesses/:id', async (req, res, next) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.params.id },
      include: {
        listings: {
          where: { status: 'AVAILABLE' },
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    res.json(business);
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET BUSINESS TYPES
// ===========================================
router.get('/business-types', (req, res) => {
  res.json([
    { id: 'SHELTER', name: 'Animal Shelter', icon: '🏠' },
    { id: 'RESCUE', name: 'Rescue Organization', icon: '💚' },
    { id: 'NONPROFIT', name: 'Non-Profit', icon: '🤝' },
    { id: 'PET_STORE', name: 'Pet Store', icon: '🏪' },
    { id: 'BREEDER', name: 'Breeder', icon: '🐕' },
    { id: 'VETERINARY', name: 'Veterinary', icon: '⚕️' },
    { id: 'GROOMING', name: 'Grooming', icon: '✂️' },
    { id: 'TRAINING', name: 'Training', icon: '🎓' }
  ]);
});

module.exports = router;
