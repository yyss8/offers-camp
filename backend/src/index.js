import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getDb } from "./db.js";
import { createUserRepo } from "./repositories/userRepo.js";
import { createOfferRepo } from "./repositories/offerRepo.js";

const app = express();
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const isProd = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET || "dev-session-secret";

app.set("trust proxy", 1);
app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 180 * 24 * 60 * 60 * 1000
    }
  })
);

const db = getDb();
const userRepo = createUserRepo(db);
const offerRepo = createOfferRepo(db);

app.use((req, _res, next) => {
  req.db = db;
  req.userRepo = userRepo;
  req.offerRepo = offerRepo;
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getBearerToken(req) {
  const header = String(req.get("authorization") || "");
  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }
  return header.slice(7).trim();
}

async function requireAuth(req, res, next) {
  if (req.session?.user) {
    req.user = req.session.user;
    return next();
  }
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const user = await req.userRepo.findByToken(token);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = { id: user.id, username: user.username, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
}

app.get("/auth/me", (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ user: req.session.user });
});

app.get("/auth/verify", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post("/auth/register", async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const email = String(req.body?.email || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const hash = await bcrypt.hash(password, 12);
    const created = await req.userRepo.createUser({
      username,
      email,
      passwordHash: hash
    });
    req.session.user = { id: created.id, username, email };
    res.json({ user: req.session.user });
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "User already exists" });
    }
    next(err);
  }
});

app.post("/auth/login", async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }
    const user = await req.userRepo.findByUsernameOrEmail(username);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    req.session.user = { id: user.id, username: user.username, email: user.email };
    res.json({ user: req.session.user });
  } catch (err) {
    next(err);
  }
});

app.post("/auth/logout", (req, res) => {
  if (!req.session) {
    return res.json({ ok: true });
  }
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: "Failed to logout" });
    }
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

app.post("/auth/token", async (req, res, next) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = crypto.randomBytes(32).toString("hex");
    await req.userRepo.updateToken(req.session.user.id, token);
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

app.get("/cards", requireAuth, async (req, res, next) => {
  try {
    const cards = await req.offerRepo.listCards(req.user.id);
    res.json({ cards });
  } catch (err) {
    next(err);
  }
});

app.get("/offers", requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200);
    const offset = (page - 1) * limit;
    const query = String(req.query.q || "").trim();
    const card = String(req.query.card || "").trim();
    const filters = { query, card };

    const totals = await req.offerRepo.countTotals(req.user.id, filters);
    const ids = await req.offerRepo.listOfferIds(req.user.id, filters, { limit, offset });
    if (!ids.length) {
      return res.json({
        offers: [],
        total: totals.total,
        totalRows: totals.totalRows,
        page,
        limit
      });
    }

    const normalized = await req.offerRepo.listOffersByIds(req.user.id, filters, ids);
    res.json({
      offers: normalized,
      total: totals.total,
      totalRows: totals.totalRows,
      page,
      limit
    });
  } catch (err) {
    next(err);
  }
});

app.post("/offers", requireAuth, async (req, res, next) => {
  try {
    const offers = Array.isArray(req.body?.offers) ? req.body.offers : [];
    if (!offers.length) {
      return res.status(400).json({ error: "No offers provided" });
    }

    const count = await req.offerRepo.upsertOffers(req.user.id, offers);
    const cardsToIds = new Map();
    offers.forEach(offer => {
      const card = offer.cardLast5 || offer.card_last5 || "";
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

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
