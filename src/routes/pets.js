// ===========================================
// PET ROUTES - /api/v1/pets
// ===========================================

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const prisma = require('../config/database');
const logger = require('../utils/logger');

const MAX_PETS_PER_USER = 5;

// ===========================================
// GET MY PETS
// ===========================================
router.get('/my-pets', authenticate, async (req, res, next) => {
  try {
    const pets = await prisma.pet.findMany({
      where: { ownerId: req.user.id, isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(pets);
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET PET BY ID
// ===========================================
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const pet = await prisma.pet.findUnique({
      where: { id: req.params.id },
      include: {
        owner: {
          select: { id: true, name: true, username: true, avatarUrl: true }
        }
      }
    });
    
    if (!pet || !pet.isActive) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    res.json({
      ...pet,
      isOwner: req.user?.id === pet.ownerId
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE PET
// ===========================================
router.post('/',
  authenticate,
  body('name').trim().notEmpty().withMessage('Pet name is required'),
  body('species').isIn(['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER']).withMessage('Valid species required'),
  body('breed').optional().trim(),
  body('size').optional().isIn(['SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE']),
  body('gender').optional().isIn(['MALE', 'FEMALE', 'UNKNOWN']),
  validate,
  async (req, res, next) => {
    try {
      // Check pet limit
      const petCount = await prisma.pet.count({
        where: { ownerId: req.user.id, isActive: true }
      });
      
      if (petCount >= MAX_PETS_PER_USER) {
        return res.status(400).json({ 
          error: `You can only have up to ${MAX_PETS_PER_USER} pets` 
        });
      }
      
      const {
        name, species, breed, color, size, age, gender,
        birthday, bio, photos, profilePhoto, isNeutered,
        microchipId, specialNeeds
      } = req.body;
      
      const pet = await prisma.pet.create({
        data: {
          ownerId: req.user.id,
          name,
          species,
          breed,
          color,
          size,
          age,
          gender,
          birthday: birthday ? new Date(birthday) : null,
          bio,
          photos: photos || [],
          profilePhoto,
          isNeutered,
          microchipId,
          specialNeeds
        }
      });
      
      logger.info(`Pet created: ${pet.id} by user ${req.user.id}`);
      res.status(201).json(pet);
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// UPDATE PET
// ===========================================
router.put('/:id',
  authenticate,
  param('id').isUUID(),
  validate,
  async (req, res, next) => {
    try {
      const pet = await prisma.pet.findUnique({
        where: { id: req.params.id },
        select: { ownerId: true }
      });
      
      if (!pet) {
        return res.status(404).json({ error: 'Pet not found' });
      }
      
      if (pet.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const {
        name, breed, color, size, age, gender,
        birthday, bio, photos, profilePhoto, isNeutered,
        microchipId, specialNeeds
      } = req.body;
      
      const updatedPet = await prisma.pet.update({
        where: { id: req.params.id },
        data: {
          name,
          breed,
          color,
          size,
          age,
          gender,
          birthday: birthday ? new Date(birthday) : undefined,
          bio,
          photos,
          profilePhoto,
          isNeutered,
          microchipId,
          specialNeeds
        }
      });
      
      res.json(updatedPet);
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// DELETE PET
// ===========================================
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const pet = await prisma.pet.findUnique({
      where: { id: req.params.id },
      select: { ownerId: true }
    });
    
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    if (pet.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await prisma.pet.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });
    
    res.json({ message: 'Pet deleted' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// PET FRIENDSHIPS
// ===========================================

// Send friend request
router.post('/:id/friend-request',
  authenticate,
  async (req, res, next) => {
    try {
      const { fromPetId } = req.body;
      const toPetId = req.params.id;
      
      // Verify ownership of fromPet
      const fromPet = await prisma.pet.findUnique({
        where: { id: fromPetId },
        select: { ownerId: true }
      });
      
      if (!fromPet || fromPet.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Not your pet' });
      }
      
      // Check if already friends
      const existing = await prisma.petFriendship.findFirst({
        where: {
          OR: [
            { petId: fromPetId, friendId: toPetId },
            { petId: toPetId, friendId: fromPetId }
          ]
        }
      });
      
      if (existing) {
        return res.status(400).json({ error: 'Friend request already exists' });
      }
      
      const friendship = await prisma.petFriendship.create({
        data: {
          petId: fromPetId,
          friendId: toPetId,
          status: 'PENDING'
        }
      });
      
      res.status(201).json(friendship);
    } catch (error) {
      next(error);
    }
  }
);

// Accept friend request
router.post('/:id/accept-friend',
  authenticate,
  async (req, res, next) => {
    try {
      const { friendshipId } = req.body;
      
      const friendship = await prisma.petFriendship.findUnique({
        where: { id: friendshipId },
        include: { friend: { select: { ownerId: true } } }
      });
      
      if (!friendship || friendship.friend.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const updated = await prisma.petFriendship.update({
        where: { id: friendshipId },
        data: { status: 'ACCEPTED' }
      });
      
      // Update friend counts
      await prisma.pet.update({
        where: { id: friendship.petId },
        data: { friendsCount: { increment: 1 } }
      });
      await prisma.pet.update({
        where: { id: friendship.friendId },
        data: { friendsCount: { increment: 1 } }
      });
      
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Get pet's friends
router.get('/:id/friends', async (req, res, next) => {
  try {
    const friendships = await prisma.petFriendship.findMany({
      where: {
        OR: [
          { petId: req.params.id, status: 'ACCEPTED' },
          { friendId: req.params.id, status: 'ACCEPTED' }
        ]
      },
      include: {
        pet: { select: { id: true, name: true, profilePhoto: true, species: true } },
        friend: { select: { id: true, name: true, profilePhoto: true, species: true } }
      }
    });
    
    // Return the friend (not the requesting pet)
    const friends = friendships.map(f => 
      f.petId === req.params.id ? f.friend : f.pet
    );
    
    res.json(friends);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
