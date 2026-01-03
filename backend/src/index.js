import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import helmet from 'helmet';
import timeout from 'connect-timeout';
import { getDb } from './db.js';
import { createUserRepo } from './repositories/userRepo.js';
import { createOfferRepo } from './repositories/offerRepo.js';
import { createVerificationCodeRepo } from './repositories/verificationCodeRepo.js';
import authRoutes from './routes/auth.js';
import offersRoutes from './routes/offers.js';

const app = express();
const frontendOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const isProd = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || 'dev-session-secret';

app.set('trust proxy', 1);

// Security headers
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (frontendOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Request timeout - 60 seconds for all requests
app.use(timeout('60s'));

// Increase JSON payload limit to 2MB for bulk offer uploads
app.use(express.json({ limit: '2mb' }));

// Halt on timeout
app.use((req, res, next) => {
  if (!req.timedout) next();
});

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 180 * 24 * 60 * 60 * 1000,
    },
  })
);

const db = getDb();
const userRepo = createUserRepo(db);
const offerRepo = createOfferRepo(db);
const verificationCodeRepo = createVerificationCodeRepo(db);

// Attach repositories to request object
app.use((req, _res, next) => {
  req.db = db;
  req.userRepo = userRepo;
  req.offerRepo = offerRepo;
  req.verificationCodeRepo = verificationCodeRepo;
  next();
});

// Mount routes
app.use('/auth', authRoutes);
app.use('/offers', offersRoutes);
app.use('/cards', offersRoutes); // /cards routes are in offersRoutes
app.use('/sources', offersRoutes); // /sources routes are in offersRoutes

// Error handler
app.use((err, _req, res) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
