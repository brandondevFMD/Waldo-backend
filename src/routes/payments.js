// ===========================================
// PAYMENT ROUTES - /api/v1/payments
// ===========================================

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const stripe = require('../config/stripe');
const prisma = require('../config/database');
const { notifyUser } = require('../services/notificationService');
const logger = require('../utils/logger');

const PLATFORM_FEE_PERCENT = 0.05; // 5%

// ===========================================
// CREATE REWARD PAYMENT INTENT
// ===========================================
router.post('/reward/create-intent',
  authenticate,
  body('lostPetReportId').isUUID(),
  body('amount').isFloat({ min: 1, max: 10000 }),
  validate,
  async (req, res, next) => {
    try {
      const { lostPetReportId, amount } = req.body;
      
      const report = await prisma.lostPetReport.findUnique({
        where: { id: lostPetReportId },
        select: { ownerId: true, rewardEscrowed: true }
      });
      
      if (!report || report.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      if (report.rewardEscrowed) {
        return res.status(400).json({ error: 'Reward already set' });
      }
      
      // Calculate amounts
      const rewardAmount = Math.round(parseFloat(amount) * 100);
      const platformFee = Math.round(rewardAmount * PLATFORM_FEE_PERCENT);
      const totalAmount = rewardAmount + platformFee;
      
      // Get or create Stripe customer
      let user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { stripeCustomerId: true, email: true, name: true }
      });
      
      if (!user.stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { userId: req.user.id }
        });
        
        await prisma.user.update({
          where: { id: req.user.id },
          data: { stripeCustomerId: customer.id }
        });
        
        user.stripeCustomerId = customer.id;
      }
      
      // Create PaymentIntent with manual capture
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'usd',
        customer: user.stripeCustomerId,
        capture_method: 'manual',
        metadata: {
          userId: req.user.id,
          lostPetReportId,
          rewardAmount: rewardAmount.toString(),
          platformFee: platformFee.toString()
        }
      });
      
      res.json({
        clientSecret: paymentIntent.client_secret,
        rewardAmount: rewardAmount / 100,
        platformFee: platformFee / 100,
        totalAmount: totalAmount / 100
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// CONFIRM REWARD (after payment)
// ===========================================
router.post('/reward/confirm',
  authenticate,
  body('lostPetReportId').isUUID(),
  body('paymentIntentId').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const { lostPetReportId, paymentIntentId } = req.body;
      
      const report = await prisma.lostPetReport.findUnique({
        where: { id: lostPetReportId },
        select: { ownerId: true }
      });
      
      if (!report || report.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      // Capture the payment
      const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
      
      const rewardAmount = parseInt(paymentIntent.metadata.rewardAmount) / 100;
      
      // Update report
      await prisma.lostPetReport.update({
        where: { id: lostPetReportId },
        data: {
          rewardAmount,
          rewardEscrowed: true,
          stripePaymentIntentId: paymentIntentId
        }
      });
      
      // Create transaction record
      await prisma.transaction.create({
        data: {
          userId: req.user.id,
          type: 'REWARD_ESCROW',
          amount: paymentIntent.amount / 100,
          fee: parseInt(paymentIntent.metadata.platformFee) / 100,
          netAmount: rewardAmount,
          stripePaymentIntentId: paymentIntentId,
          lostPetReportId,
          status: 'COMPLETED'
        }
      });
      
      // Notify user
      const io = req.app.get('io');
      await notifyUser(io, req.user.id, {
        type: 'REWARD_ESCROWED',
        title: 'Reward Set',
        message: `$${rewardAmount} reward is now active`,
        data: { reportId: lostPetReportId }
      });
      
      res.json({ success: true, rewardAmount });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// SUBMIT REWARD CLAIM
// ===========================================
router.post('/reward/claim',
  authenticate,
  body('lostPetReportId').isUUID(),
  body('currentLocation').notEmpty(),
  body('contactPhone').notEmpty(),
  validate,
  async (req, res, next) => {
    try {
      const { lostPetReportId, currentLocation, contactPhone, photoProofUrl, notes } = req.body;
      
      const report = await prisma.lostPetReport.findUnique({
        where: { id: lostPetReportId },
        select: { ownerId: true, rewardEscrowed: true, petName: true }
      });
      
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      
      if (!report.rewardEscrowed) {
        return res.status(400).json({ error: 'No reward set' });
      }
      
      if (report.ownerId === req.user.id) {
        return res.status(400).json({ error: 'Cannot claim your own reward' });
      }
      
      const claim = await prisma.rewardClaim.create({
        data: {
          lostPetReportId,
          claimantId: req.user.id,
          currentLocation,
          contactPhone,
          photoProofUrl,
          notes
        }
      });
      
      // Notify owner
      const io = req.app.get('io');
      await notifyUser(io, report.ownerId, {
        type: 'REWARD_CLAIMED',
        title: `Someone found ${report.petName}!`,
        message: 'Review the claim to release the reward',
        data: { reportId: lostPetReportId, claimId: claim.id }
      });
      
      res.status(201).json(claim);
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// GET CLAIMS (owner only)
// ===========================================
router.get('/reward/claims/:reportId', authenticate, async (req, res, next) => {
  try {
    const report = await prisma.lostPetReport.findUnique({
      where: { id: req.params.reportId },
      select: { ownerId: true }
    });
    
    if (!report || report.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const claims = await prisma.rewardClaim.findMany({
      where: { lostPetReportId: req.params.reportId },
      include: {
        claimant: { select: { id: true, name: true, avatarUrl: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(claims);
  } catch (error) {
    next(error);
  }
});

// ===========================================
// RELEASE REWARD
// ===========================================
router.post('/reward/release',
  authenticate,
  body('claimId').isUUID(),
  validate,
  async (req, res, next) => {
    try {
      const { claimId } = req.body;
      
      const claim = await prisma.rewardClaim.findUnique({
        where: { id: claimId },
        include: {
          lostPetReport: { select: { ownerId: true, rewardAmount: true, stripePaymentIntentId: true } },
          claimant: { select: { id: true, stripeAccountId: true } }
        }
      });
      
      if (!claim || claim.lostPetReport.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      if (!claim.claimant.stripeAccountId) {
        return res.status(400).json({ error: 'Claimant needs to set up payout account' });
      }
      
      // Transfer to finder
      const payoutAmount = Math.round(parseFloat(claim.lostPetReport.rewardAmount) * 100);
      
      const transfer = await stripe.transfers.create({
        amount: payoutAmount,
        currency: 'usd',
        destination: claim.claimant.stripeAccountId,
        metadata: { claimId, lostPetReportId: claim.lostPetReportId }
      });
      
      // Update claim
      await prisma.rewardClaim.update({
        where: { id: claimId },
        data: {
          status: 'PAID',
          stripeTransferId: transfer.id,
          paidAmount: claim.lostPetReport.rewardAmount,
          paidAt: new Date()
        }
      });
      
      // Update report status
      await prisma.lostPetReport.update({
        where: { id: claim.lostPetReportId },
        data: { status: 'REUNITED' }
      });
      
      // Update finder stats
      await prisma.user.update({
        where: { id: claim.claimant.id },
        data: {
          petsFound: { increment: 1 },
          totalEarned: { increment: parseFloat(claim.lostPetReport.rewardAmount) }
        }
      });
      
      // Notify finder
      const io = req.app.get('io');
      await notifyUser(io, claim.claimant.id, {
        type: 'REWARD_RELEASED',
        title: 'Reward Received!',
        message: `$${claim.lostPetReport.rewardAmount} has been sent to your account`,
        data: { claimId }
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// STRIPE CONNECT SETUP
// ===========================================
router.post('/connect/create', authenticate, async (req, res, next) => {
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      metadata: { userId: req.user.id }
    });
    
    await prisma.user.update({
      where: { id: req.user.id },
      data: { stripeAccountId: account.id }
    });
    
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL}/settings/payments`,
      return_url: `${process.env.FRONTEND_URL}/settings/payments?success=true`,
      type: 'account_onboarding'
    });
    
    res.json({ url: accountLink.url });
  } catch (error) {
    next(error);
  }
});

// Get connect status
router.get('/connect/status', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { stripeAccountId: true }
    });
    
    if (!user.stripeAccountId) {
      return res.json({ connected: false });
    }
    
    const account = await stripe.accounts.retrieve(user.stripeAccountId);
    
    res.json({
      connected: true,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
