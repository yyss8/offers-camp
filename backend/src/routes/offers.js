import express from 'express';
import expressRateLimit from 'express-rate-limit';
import { isLocalRequest } from '../utils/requestUtils.js';

const router = express.Router();

// Offers rate limiter - allow plugin's 500ms frequency (120 per minute)
// but prevent sustained abuse over longer periods
const offersLimiter = expressRateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 150, // Allow 150 requests per minute (plugin sends ~120/min)
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
});

// Helper functions

function getRequestToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

async function requireAuth(req, res, next) {
  const token = getRequestToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const user = await req.userRepo.findByToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: user.id, username: user.username, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
}

async function requireAuthOrLocal(req, res, next) {
  // First priority: Check if there's a session user (from browser login)
  if (req.session?.user) {
    req.user = req.session.user;
    return next();
  }

  // Second priority: Check for Bearer token (from Tampermonkey script)
  const token = getRequestToken(req);
  if (token) {
    return requireAuth(req, res, next);
  }

  // Third priority: If local request without session or token, default to user_id 1
  if (isLocalRequest(req)) {
    req.user = { id: 1 };
    return next();
  }

  // No authentication found
  return res.status(401).json({ error: 'Unauthorized' });
}

// Routes
router.get('/', requireAuthOrLocal, async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200);
    const offset = (page - 1) * limit;
    const query = String(req.query.q || '').trim();
    const card = String(req.query.card || '').trim();
    const source = String(req.query.source || '').trim();
    const highlighted = req.query.highlighted; // 'true', 'false', or undefined
    const filters = { query, card, source, highlighted };

    const totals = await req.offerRepo.countTotals(req.user.id, filters);
    const ids = await req.offerRepo.listOfferIds(req.user.id, filters, { limit, offset });
    if (!ids.length) {
      return res.json({
        offers: [],
        total: totals.total,
        totalRows: totals.totalRows,
        page,
        limit,
      });
    }

    const normalized = await req.offerRepo.listOffersByIds(req.user.id, filters, ids);
    res.json({
      offers: normalized,
      total: totals.total,
      totalRows: totals.totalRows,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', offersLimiter, requireAuthOrLocal, async (req, res, next) => {
  try {
    const offers = Array.isArray(req.body?.offers) ? req.body.offers : [];
    if (!offers.length) {
      return res.status(400).json({ error: 'No offers provided' });
    }

    const count = await req.offerRepo.upsertOffers(req.user.id, offers);
    const cardsToIds = new Map();
    offers.forEach((offer) => {
      const card = offer.cardNum || offer.card_num || '';
      if (!card) return;
      const list = cardsToIds.get(card) || [];
      list.push(offer.id);
      cardsToIds.set(card, list);
    });

    for (const [card, ids] of cardsToIds.entries()) {
      await req.offerRepo.deleteMissingByCard(req.user.id, card, ids);
    }

    res.json({ ok: true, count });
  } catch (err) {
    next(err);
  }
});

router.get('/cards', requireAuthOrLocal, async (req, res, next) => {
  try {
    const cards = await req.offerRepo.listCards(req.user.id);
    res.json({ cards });
  } catch (err) {
    next(err);
  }
});

router.get('/sources', requireAuthOrLocal, async (req, res, next) => {
  try {
    const sources = await req.offerRepo.listSources(req.user.id);
    res.json({ sources });
  } catch (err) {
    next(err);
  }
});

router.post('/:offerId/highlight', requireAuthOrLocal, async (req, res, next) => {
  try {
    const offerId = req.params.offerId;
    const highlighted = !!req.body?.highlighted;

    if (!offerId) {
      return res.status(400).json({ error: 'Offer ID required' });
    }

    const result = await req.offerRepo.toggleHighlight(req.user.id, offerId, highlighted);
    res.json({ ok: true, highlighted: result });
  } catch (err) {
    next(err);
  }
});

export default router;
