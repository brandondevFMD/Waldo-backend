// ===========================================
// IMAGE UPLOAD SERVICE - AWS S3
// ===========================================

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET = process.env.AWS_S3_BUCKET;
const CDN_URL = process.env.AWS_CLOUDFRONT_URL || `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`;

// Image size configurations
const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150, fit: 'cover' },
  medium: { width: 600, height: 600, fit: 'inside' },
  large: { width: 1200, height: 1200, fit: 'inside' }
};

// ===========================================
// UPLOAD IMAGE
// ===========================================
exports.uploadImage = async (file, options = {}) => {
  try {
    const { folder = 'dogs', userId, generateThumbnail = true } = options;
    
    // Generate unique filename
    const ext = file.originalname.split('.').pop().toLowerCase();
    const filename = `${uuidv4()}.${ext}`;
    const key = `${folder}/${filename}`;
    
    // Process image with sharp
    let processedBuffer = await sharp(file.buffer)
      .resize(IMAGE_SIZES.large)
      .jpeg({ quality: 85 })
      .toBuffer();
    
    // Upload main image
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: processedBuffer,
      ContentType: 'image/jpeg',
      Metadata: {
        userId: userId || 'anonymous',
        originalName: file.originalname
      }
    }));
    
    const result = {
      url: `${CDN_URL}/${key}`,
      key
    };
    
    // Generate and upload thumbnail
    if (generateThumbnail) {
      const thumbnailBuffer = await sharp(file.buffer)
        .resize(IMAGE_SIZES.thumbnail)
        .jpeg({ quality: 80 })
        .toBuffer();
      
      const thumbnailKey = `${folder}/thumbnails/${filename}`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg'
      }));
      
      result.thumbnailUrl = `${CDN_URL}/${thumbnailKey}`;
      result.thumbnailKey = thumbnailKey;
    }
    
    logger.info(`Image uploaded: ${key}`);
    
    return result;
  } catch (error) {
    logger.error('Upload image error:', error);
    throw error;
  }
};

// ===========================================
// UPLOAD MULTIPLE IMAGES
// ===========================================
exports.uploadImages = async (files, options = {}) => {
  const results = await Promise.all(
    files.map(file => exports.uploadImage(file, options))
  );
  return results;
};

// ===========================================
// DELETE IMAGE
// ===========================================
exports.deleteImage = async (key) => {
  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key
    }));
    
    // Also delete thumbnail if exists
    const thumbnailKey = key.replace(/\/([^/]+)$/, '/thumbnails/$1');
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: thumbnailKey
      }));
    } catch (e) {
      // Thumbnail might not exist, ignore
    }
    
    logger.info(`Image deleted: ${key}`);
  } catch (error) {
    logger.error('Delete image error:', error);
    throw error;
  }
};

// ===========================================
// GET SIGNED UPLOAD URL (for direct client uploads)
// ===========================================
exports.getSignedUploadUrl = async (options = {}) => {
  const { folder = 'dogs', contentType = 'image/jpeg', expiresIn = 300 } = options;
  
  const filename = `${uuidv4()}.jpg`;
  const key = `${folder}/${filename}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType
  });
  
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
  
  return {
    uploadUrl: signedUrl,
    key,
    publicUrl: `${CDN_URL}/${key}`
  };
};

// ===========================================
// VALIDATE IMAGE FILE
// ===========================================
exports.validateImage = (file) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Allowed: JPEG, PNG, WebP, HEIC');
  }
  
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size: 10MB');
  }
  
  return true;
};
