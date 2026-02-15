// ===========================================
// USER ROUTES - /api/v1/users
// ===========================================

const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const prisma = require('../config/database');

// Get my profile
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, name: true, username: true,
        phone: true, avatarUrl: true, bio: true, location: true,
        isVerified: true, petsFound: true, sightingsReported: true,
        totalEarned: true, createdAt: true,
        _count: { select: { pets: true, following: true, followers: true } }
      }
    });
    res.json({
      ...user,
      petCount: user._count.pets,
      followingCount: user._count.following,
      followersCount: user._count.followers,
      _count: undefined
    });
  } catch (error) {
    next(error);
  }
});

// Update profile
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { name, username, phone, avatarUrl, bio, location } = req.body;
    
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, username, phone, avatarUrl, bio, location },
      select: {
        id: true, email: true, name: true, username: true,
        phone: true, avatarUrl: true, bio: true, location: true
      }
    });
    
    res.json(user);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Username already taken' });
    }
    next(error);
  }
});

// Get user by ID
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, username: true, avatarUrl: true, bio: true,
        location: true, isVerified: true, petsFound: true,
        sightingsReported: true, createdAt: true,
        _count: { select: { pets: true, followers: true, following: true } }
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if following
    let isFollowing = false;
    if (req.user) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: { followerId: req.user.id, followingId: req.params.id }
        }
      });
      isFollowing = !!follow;
    }
    
    res.json({
      ...user,
      petCount: user._count.pets,
      followingCount: user._count.following,
      followersCount: user._count.followers,
      isFollowing,
      isMe: req.user?.id === req.params.id,
      _count: undefined
    });
  } catch (error) {
    next(error);
  }
});

// Follow user
router.post('/:id/follow', authenticate, async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }
    
    await prisma.follow.create({
      data: { followerId: req.user.id, followingId: req.params.id }
    });
    
    res.json({ following: true });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Already following' });
    }
    next(error);
  }
});

// Unfollow user
router.delete('/:id/follow', authenticate, async (req, res, next) => {
  try {
    await prisma.follow.delete({
      where: {
        followerId_followingId: { followerId: req.user.id, followingId: req.params.id }
      }
    });
    
    res.json({ following: false });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(400).json({ error: 'Not following' });
    }
    next(error);
  }
});

// Get user's pets
router.get('/:id/pets', async (req, res, next) => {
  try {
    const pets = await prisma.pet.findMany({
      where: { ownerId: req.params.id, isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(pets);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
