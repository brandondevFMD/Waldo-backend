// ===========================================
// STRIPE WEBHOOKS
// ===========================================

const express = require('express');
const router = express.Router();
const stripe = require('../../config/stripe');
const prisma = require('../../config/database');
const { notifyUser } = require('../../services/notificationService');
const logger = require('../../utils/logger');

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  const io = req.app.get('io');
  
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        logger.info(`Payment succeeded: ${paymentIntent.id}`);
        
        // Update transaction status if exists
        await prisma.transaction.updateMany({
          where: { stripePaymentIntentId: paymentIntent.id },
          data: { status: 'COMPLETED' }
        });
        break;
      }
      
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        logger.warn(`Payment failed: ${paymentIntent.id}`);
        
        // Update transaction status
        await prisma.transaction.updateMany({
          where: { stripePaymentIntentId: paymentIntent.id },
          data: { status: 'FAILED' }
        });
        
        // Notify user
        if (paymentIntent.metadata?.userId) {
          await notifyUser(io, paymentIntent.metadata.userId, {
            type: 'SYSTEM',
            title: 'Payment Failed',
            message: 'Your bounty payment could not be processed. Please try again.',
            data: { dogId: paymentIntent.metadata.dogId }
          });
        }
        break;
      }
      
      case 'transfer.created': {
        const transfer = event.data.object;
        logger.info(`Transfer created: ${transfer.id}`);
        break;
      }
      
      case 'transfer.failed': {
        const transfer = event.data.object;
        logger.error(`Transfer failed: ${transfer.id}`);
        
        // Handle failed payout
        if (transfer.metadata?.finderId) {
          await notifyUser(io, transfer.metadata.finderId, {
            type: 'SYSTEM',
            title: 'Payout Issue',
            message: 'There was an issue with your bounty payout. Please contact support.',
            data: {}
          });
        }
        break;
      }
      
      case 'account.updated': {
        const account = event.data.object;
        
        // Update user's connect status
        if (account.metadata?.userId) {
          const canReceive = account.capabilities?.transfers === 'active';
          logger.info(`Connect account updated: ${account.id}, can receive: ${canReceive}`);
        }
        break;
      }
      
      case 'charge.refunded': {
        const charge = event.data.object;
        logger.info(`Charge refunded: ${charge.id}`);
        break;
      }
      
      default:
        logger.debug(`Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

module.exports = router;
