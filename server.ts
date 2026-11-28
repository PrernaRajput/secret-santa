import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { z } from 'zod';
import {
  getDailyElfChallenge,
  getEventLocalDateKey,
  moderateAnonymousMessage,
  pickWeightedWheelPrize,
} from './src/utils/workshopLogic.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

// Simple in-memory sliding-window rate limiter per IP + route
const rateBuckets = new Map<string, number[]>();

function isRateLimited(bucketKey: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const prev = rateBuckets.get(bucketKey) || [];
  const active = prev.filter((ts) => now - ts < windowMs);
  if (active.length >= maxRequests) {
    rateBuckets.set(bucketKey, active);
    return true;
  }
  active.push(now);
  rateBuckets.set(bucketKey, active);
  return false;
}

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'local';
}

const wheelSpinRequestSchema = z.object({
  eventId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  participantKey: z.string().regex(/^[a-f0-9]{64}$/),
  timezone: z.string().min(2).max(64).default('Asia/Kolkata'),
});

const moderateRequestSchema = z.object({
  body: z.string().min(1).max(600),
});

const recoveryRequestSchema = z.object({
  eventId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  requestedName: z.string().trim().min(1).max(100),
  verificationHint: z.string().trim().max(240).optional().default(''),
});

export function createApiRouter() {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true, serverTimeIso: new Date().toISOString() });
  });

  // Authoritative server clock, event-local calendar day & daily Hidden Elf challenge
  router.get('/workshop/server-time', (req, res) => {
    const rawTz = typeof req.query.tz === 'string' ? req.query.tz.slice(0, 64) : 'Asia/Kolkata';
    const rawEventId =
      typeof req.query.eventId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(req.query.eventId)
        ? req.query.eventId
        : 'default-secret-santa-2026';

    const now = new Date();
    const dateKey = getEventLocalDateKey(now, rawTz);
    const elfChallenge = getDailyElfChallenge(dateKey, rawEventId);

    res.json({
      serverTimeMs: now.getTime(),
      serverTimeIso: now.toISOString(),
      timezone: rawTz,
      dateKey,
      elfChallenge: {
        challengeId: elfChallenge.challengeId,
        spotId: elfChallenge.spotId,
        spotLabel: elfChallenge.spotLabel,
        spotHint: elfChallenge.spotHint,
        spotEmoji: elfChallenge.spotEmoji,
        rewardTitle: elfChallenge.reward.title,
        rewardEmoji: elfChallenge.reward.emoji,
        collectibleId: elfChallenge.reward.collectibleId,
        rewardJoke: elfChallenge.reward.joke,
      },
    });
  });

  // Cryptographically fair server-selected Wheel spin outcome (1 per day enforced via Firestore + rate limit)
  router.post('/workshop/wheel-spin', (req, res) => {
    const ip = getClientIp(req);
    if (isRateLimited(`wheel:${ip}`, 20, 60_000)) {
      res.status(429).json({ ok: false, error: 'Slow down! Santa’s wheel needs a breather.' });
      return;
    }

    const parsed = wheelSpinRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid wheel spin request.' });
      return;
    }

    const { timezone } = parsed.data;
    const now = new Date();
    const dateKey = getEventLocalDateKey(now, timezone);

    // Cryptographically uniform float in [0, 1)
    const randInt = crypto.randomInt(0, 1_000_000);
    const prize = pickWeightedWheelPrize(randInt / 1_000_000);

    res.json({
      ok: true,
      dateKey,
      serverTimeIso: now.toISOString(),
      prize: {
        id: prize.id,
        slotIndex: prize.slotIndex,
        label: prize.label,
        emoji: prize.emoji,
        message: prize.message,
        kind: prize.kind,
        collectibleId: prize.collectibleId || '',
        collectibleName: prize.collectibleName || '',
      },
    });
  });

  // Server-side content moderation & rate-limiting for Anonymous Mailbox
  router.post('/workshop/moderate', (req, res) => {
    const ip = getClientIp(req);
    if (isRateLimited(`mailbox:${ip}`, 15, 60_000)) {
      res.status(429).json({
        ok: false,
        reason: 'Santa’s postal owls are flying fast! Wait a minute before sending another message.',
      });
      return;
    }

    const parsed = moderateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, reason: 'Please enter a valid message under 500 characters.' });
      return;
    }

    const result = moderateAnonymousMessage(parsed.data.body);
    if (!result.ok) {
      res.status(422).json({ ok: false, reason: result.reason });
      return;
    }

    res.json({ ok: true, sanitized: result.sanitized });
  });

  // Rate-limited, non-enumerating session recovery request intake
  router.post('/workshop/recovery-request', (req, res) => {
    const ip = getClientIp(req);
    if (isRateLimited(`recovery:${ip}`, 5, 10 * 60_000)) {
      res.status(429).json({
        ok: false,
        message: 'Too many recovery requests from this connection. Please wait a few minutes and try again.',
      });
      return;
    }

    const parsed = recoveryRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        message: 'Please provide your name so the organizer can verify your invitation out-of-band.',
      });
      return;
    }

    // Never reveal whether a specific participant exists in the system
    res.json({
      ok: true,
      requestId: `rec_${crypto.randomBytes(12).toString('hex')}`,
      message:
        'Your request has been logged for the event organizer. Once they verify your identity, they will send you a fresh one-time recovery link!',
    });
  });

  return router;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.use('/api', createApiRouter());

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Secret Santa server listening on http://0.0.0.0:${PORT}`);
  });
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectExecution) {
  void startServer();
}
