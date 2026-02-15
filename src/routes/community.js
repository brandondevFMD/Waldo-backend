// ===========================================
// COMMUNITY ROUTES - /api/v1/community
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
// GET POSTS (FEED)
// ===========================================
router.get('/posts',
  optionalAuth,
  query('category').optional().isIn([
    'GENERAL', 'ADVICE', 'QUESTION', 'HEALTH', 'TRAINING',
    'NUTRITION', 'GROOMING', 'BEHAVIOR', 'PRODUCT_REVIEW', 'STORY'
  ]),
  validate,
  async (req, res, next) => {
    try {
      const { category, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      
      const where = { isPublic: true };
      if (category) where.category = category;
      
      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where,
          include: {
            author: { select: { id: true, name: true, username: true, avatarUrl: true } },
            _count: { select: { comments: true, likes: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: parseInt(limit)
        }),
        prisma.post.count({ where })
      ]);
      
      // Check if user liked posts
      let likedPostIds = [];
      if (req.user) {
        const likes = await prisma.postLike.findMany({
          where: {
            userId: req.user.id,
            postId: { in: posts.map(p => p.id) }
          },
          select: { postId: true }
        });
        likedPostIds = likes.map(l => l.postId);
      }
      
      res.json({
        posts: posts.map(p => ({
          ...p,
          likesCount: p._count.likes,
          commentsCount: p._count.comments,
          isLiked: likedPostIds.includes(p.id),
          _count: undefined
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GET POST BY ID
// ===========================================
router.get('/posts/:id', optionalAuth, async (req, res, next) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      include: {
        author: { select: { id: true, name: true, username: true, avatarUrl: true } },
        _count: { select: { comments: true, likes: true } }
      }
    });
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check if user liked
    let isLiked = false;
    if (req.user) {
      const like = await prisma.postLike.findUnique({
        where: { postId_userId: { postId: post.id, userId: req.user.id } }
      });
      isLiked = !!like;
    }
    
    // Get comments
    const comments = await prisma.comment.findMany({
      where: { postId: post.id, parentId: null },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        replies: {
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } }
          },
          take: 3
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    
    res.json({
      ...post,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      isLiked,
      comments,
      isAuthor: req.user?.id === post.authorId,
      _count: undefined
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE POST
// ===========================================
router.post('/posts',
  authenticate,
  body('content').trim().notEmpty().isLength({ max: 5000 }),
  body('category').isIn([
    'GENERAL', 'ADVICE', 'QUESTION', 'HEALTH', 'TRAINING',
    'NUTRITION', 'GROOMING', 'BEHAVIOR', 'PRODUCT_REVIEW', 'STORY'
  ]),
  validate,
  async (req, res, next) => {
    try {
      const { content, category, images, tags, isPublic } = req.body;
      
      const post = await prisma.post.create({
        data: {
          authorId: req.user.id,
          content,
          category,
          images: images || [],
          tags: tags || [],
          isPublic: isPublic !== false
        },
        include: {
          author: { select: { id: true, name: true, username: true, avatarUrl: true } }
        }
      });
      
      logger.info(`Post created: ${post.id} by user ${req.user.id}`);
      res.status(201).json(post);
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// UPDATE POST
// ===========================================
router.put('/posts/:id',
  authenticate,
  body('content').optional().trim().isLength({ max: 5000 }),
  validate,
  async (req, res, next) => {
    try {
      const post = await prisma.post.findUnique({
        where: { id: req.params.id },
        select: { authorId: true }
      });
      
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      if (post.authorId !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const { content, category, images, tags } = req.body;
      
      const updated = await prisma.post.update({
        where: { id: req.params.id },
        data: { content, category, images, tags }
      });
      
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// DELETE POST
// ===========================================
router.delete('/posts/:id', authenticate, async (req, res, next) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: { authorId: true }
    });
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    if (post.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await prisma.post.delete({ where: { id: req.params.id } });
    res.json({ message: 'Post deleted' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// LIKE POST
// ===========================================
router.post('/posts/:id/like', authenticate, async (req, res, next) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: { id: true, authorId: true }
    });
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    await prisma.postLike.create({
      data: {
        postId: req.params.id,
        userId: req.user.id
      }
    });
    
    await prisma.post.update({
      where: { id: req.params.id },
      data: { likesCount: { increment: 1 } }
    });
    
    // Notify author
    if (post.authorId !== req.user.id) {
      const io = req.app.get('io');
      await notifyUser(io, post.authorId, {
        type: 'POST_LIKE',
        title: 'New Like',
        message: 'Someone liked your post',
        data: { postId: req.params.id }
      });
    }
    
    res.json({ liked: true });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Already liked' });
    }
    next(error);
  }
});

// ===========================================
// UNLIKE POST
// ===========================================
router.delete('/posts/:id/like', authenticate, async (req, res, next) => {
  try {
    await prisma.postLike.delete({
      where: {
        postId_userId: { postId: req.params.id, userId: req.user.id }
      }
    });
    
    await prisma.post.update({
      where: { id: req.params.id },
      data: { likesCount: { decrement: 1 } }
    });
    
    res.json({ liked: false });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(400).json({ error: 'Not liked' });
    }
    next(error);
  }
});

// ===========================================
// ADD COMMENT
// ===========================================
router.post('/posts/:id/comments',
  authenticate,
  body('content').trim().notEmpty().isLength({ max: 2000 }),
  body('parentId').optional().isUUID(),
  validate,
  async (req, res, next) => {
    try {
      const post = await prisma.post.findUnique({
        where: { id: req.params.id },
        select: { id: true, authorId: true }
      });
      
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      const { content, parentId } = req.body;
      
      const comment = await prisma.comment.create({
        data: {
          postId: req.params.id,
          authorId: req.user.id,
          content,
          parentId
        },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } }
        }
      });
      
      await prisma.post.update({
        where: { id: req.params.id },
        data: { commentsCount: { increment: 1 } }
      });
      
      // Notify post author or parent comment author
      const io = req.app.get('io');
      if (parentId) {
        const parentComment = await prisma.comment.findUnique({
          where: { id: parentId },
          select: { authorId: true }
        });
        if (parentComment && parentComment.authorId !== req.user.id) {
          await notifyUser(io, parentComment.authorId, {
            type: 'COMMENT_REPLY',
            title: 'New Reply',
            message: 'Someone replied to your comment',
            data: { postId: req.params.id, commentId: comment.id }
          });
        }
      } else if (post.authorId !== req.user.id) {
        await notifyUser(io, post.authorId, {
          type: 'POST_COMMENT',
          title: 'New Comment',
          message: 'Someone commented on your post',
          data: { postId: req.params.id, commentId: comment.id }
        });
      }
      
      res.status(201).json(comment);
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// DELETE COMMENT
// ===========================================
router.delete('/comments/:id', authenticate, async (req, res, next) => {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: req.params.id },
      select: { authorId: true, postId: true }
    });
    
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    if (comment.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await prisma.comment.delete({ where: { id: req.params.id } });
    
    await prisma.post.update({
      where: { id: comment.postId },
      data: { commentsCount: { decrement: 1 } }
    });
    
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET CATEGORIES
// ===========================================
router.get('/categories', (req, res) => {
  res.json([
    { id: 'GENERAL', name: 'General', description: 'General pet discussions' },
    { id: 'ADVICE', name: 'Advice', description: 'Get advice from pet owners' },
    { id: 'QUESTION', name: 'Questions', description: 'Ask the community' },
    { id: 'HEALTH', name: 'Health', description: 'Pet health topics' },
    { id: 'TRAINING', name: 'Training', description: 'Training tips and tricks' },
    { id: 'NUTRITION', name: 'Nutrition', description: 'Food and diet' },
    { id: 'GROOMING', name: 'Grooming', description: 'Grooming advice' },
    { id: 'BEHAVIOR', name: 'Behavior', description: 'Pet behavior' },
    { id: 'PRODUCT_REVIEW', name: 'Product Reviews', description: 'Review pet products' },
    { id: 'STORY', name: 'Stories', description: 'Share your pet stories' }
  ]);
});

module.exports = router;
