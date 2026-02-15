// ===========================================
// UPLOAD ROUTES - /api/v1/uploads
// ===========================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { uploadImage, uploadImages, getSignedUploadUrl, validateImage } = require('../services/uploadService');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Upload single image
router.post('/image',
  authenticate,
  upload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }
      
      validateImage(req.file);
      
      const result = await uploadImage(req.file, {
        folder: req.body.folder || 'dogs',
        userId: req.user.id
      });
      
      res.json(result);
    } catch (error) {
      if (error.message.includes('Invalid file') || error.message.includes('too large')) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }
);

// Upload multiple images
router.post('/images',
  authenticate,
  upload.array('images', 5),
  async (req, res, next) => {
    try {
      if (!req.files?.length) {
        return res.status(400).json({ error: 'No image files provided' });
      }
      
      req.files.forEach(validateImage);
      
      const results = await uploadImages(req.files, {
        folder: req.body.folder || 'dogs',
        userId: req.user.id
      });
      
      res.json(results);
    } catch (error) {
      if (error.message.includes('Invalid file') || error.message.includes('too large')) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }
);

// Get signed URL for direct upload
router.get('/signed-url', authenticate, async (req, res, next) => {
  try {
    const { folder } = req.query;
    const result = await getSignedUploadUrl({ folder });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
