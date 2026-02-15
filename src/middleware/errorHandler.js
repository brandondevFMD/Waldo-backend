// ===========================================
// ERROR HANDLER MIDDLEWARE
// ===========================================

const logger = require('../utils/logger');

// 404 handler
exports.notFoundHandler = (req, res, next) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
};

// Global error handler
exports.errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'A record with this data already exists'
    });
  }
  
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Record not found'
    });
  }
  
  // Stripe errors
  if (err.type === 'StripeCardError') {
    return res.status(400).json({
      error: err.message
    });
  }
  
  if (err.type === 'StripeInvalidRequestError') {
    return res.status(400).json({
      error: 'Invalid payment request'
    });
  }
  
  // Default error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};
