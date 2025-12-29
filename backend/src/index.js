import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getPool } from "./db.js";

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

let pool;
app.use(async (req, res, next) => {
  try {
    if (!pool) {
      pool = await getPool();
    }
    req.db = pool;
    next();
  } catch (err) {
    next(err);
  }
});

app.get("/api/health", (req, res) => {
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
    const tokenHash = hashToken(token);
    const [rows] = await req.db.query(
      "SELECT id, username, email FROM users WHERE api_token_hash = ? LIMIT 1",
      [tokenHash]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = { id: user.id, username: user.username, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
}

app.get("/api/auth/me", (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ user: req.session.user });
});

app.get("/api/auth/verify", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const email = String(req.body?.email || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const hash = await bcrypt.hash(password, 12);
    const [result] = await req.db.query(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, hash]
    );
    req.session.user = { id: result.insertId, username, email };
    res.json({ user: req.session.user });
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "User already exists" });
    }
    next(err);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }
    const [rows] = await req.db.query(
      "SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ? LIMIT 1",
      [username, username]
    );
    const user = rows[0];
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

app.post("/api/auth/logout", (req, res) => {
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

app.post("/api/auth/token", async (req, res, next) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    await req.db.query("UPDATE users SET api_token_hash = ? WHERE id = ?", [
      tokenHash,
      req.session.user.id
    ]);
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

app.get("/api/cards", requireAuth, async (req, res, next) => {
  try {
    const [rows] = await req.db.query(
      "SELECT DISTINCT card_last5 FROM offers WHERE user_id = ? AND card_last5 IS NOT NULL AND card_last5 <> '' ORDER BY card_last5",
      [req.user.id]
    );
    res.json({ cards: rows.map(row => row.card_last5) });
  } catch (err) {
    next(err);
  }
});

app.get("/api/offers", requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200);
    const offset = (page - 1) * limit;
    const query = String(req.query.q || "").trim();
    const card = String(req.query.card || "").trim();

    const whereQuery = ["user_id = ?"];
    const paramsQuery = [req.user.id];
    if (query) {
      whereQuery.push("(title LIKE ? OR summary LIKE ?)");
      paramsQuery.push(`%${query}%`, `%${query}%`);
    }

    const whereIds = [...whereQuery];
    const paramsIds = [...paramsQuery];
    if (card && card !== "all") {
      whereIds.push("card_last5 = ?");
      paramsIds.push(card);
    }
    const whereIdsSql = whereIds.length ? `WHERE ${whereIds.join(" AND ")}` : "";
    const whereQuerySql = whereQuery.length ? `WHERE ${whereQuery.join(" AND ")}` : "";

    const [[countRow]] = await req.db.query(
      `SELECT COUNT(DISTINCT id) AS total FROM offers ${whereIdsSql}`,
      paramsIds
    );

    const [[countRows]] = await req.db.query(
      `SELECT COUNT(*) AS total_rows FROM offers ${whereIdsSql}`,
      paramsIds
    );

    const [idRows] = await req.db.query(
      `SELECT id, MIN(STR_TO_DATE(SUBSTRING_INDEX(expires, ' ', -1), '%m/%d/%y')) AS expiry_date
       FROM offers ${whereIdsSql}
       GROUP BY id
       ORDER BY (expiry_date IS NULL), expiry_date ASC, id
       LIMIT ? OFFSET ?`,
      [...paramsIds, limit, offset]
    );

    if (!idRows.length) {
      return res.json({
        offers: [],
        total: countRow?.total || 0,
        totalRows: countRows?.total_rows || 0,
        page,
        limit
      });
    }

    const ids = idRows.map(row => row.id);
    const placeholders = ids.map(() => "?").join(", ");
    const whereWithIds = whereQuerySql
      ? `${whereQuerySql} AND id IN (${placeholders})`
      : `WHERE id IN (${placeholders})`;

    const [rows] = await req.db.query(
      `SELECT id, title, summary, image, expires, categories, channels, enrolled, source, card_last5
       FROM offers
       ${whereWithIds}
       ORDER BY (STR_TO_DATE(SUBSTRING_INDEX(expires, ' ', -1), '%m/%d/%y') IS NULL),
                STR_TO_DATE(SUBSTRING_INDEX(expires, ' ', -1), '%m/%d/%y') ASC,
                id`,
      [...paramsQuery, ...ids]
    );
    const normalized = rows.map(row => ({
      ...row,
      categories: typeof row.categories === "string" ? JSON.parse(row.categories) : row.categories,
      channels: typeof row.channels === "string" ? JSON.parse(row.channels) : row.channels
    }));
    res.json({
      offers: normalized,
      total: countRow?.total || 0,
      totalRows: countRows?.total_rows || 0,
      page,
      limit
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/offers", requireAuth, async (req, res, next) => {
  try {
    const offers = Array.isArray(req.body?.offers) ? req.body.offers : [];
    if (!offers.length) {
      return res.status(400).json({ error: "No offers provided" });
    }

    const values = offers.map(offer => [
      offer.id,
      req.user.id,
      offer.title,
      offer.summary || offer.description || "",
      offer.image || "",
      offer.expires || offer.expiresAt || "",
      JSON.stringify(offer.categories || []),
      JSON.stringify(offer.channels || []),
      !!offer.enrolled,
      offer.source || offer.bank || "amex",
      offer.cardLast5 || offer.card_last5 || ""
    ]);

    await req.db.query(
      "INSERT INTO offers (id, user_id, title, summary, image, expires, categories, channels, enrolled, source, card_last5) VALUES ? ON DUPLICATE KEY UPDATE title=VALUES(title), summary=VALUES(summary), image=VALUES(image), expires=VALUES(expires), categories=VALUES(categories), channels=VALUES(channels), enrolled=VALUES(enrolled), source=VALUES(source)",
      [values]
    );

    const cardsToIds = new Map();
    offers.forEach(offer => {
      const card = offer.cardLast5 || offer.card_last5 || "";
      if (!card) return;
      const list = cardsToIds.get(card) || [];
      list.push(offer.id);
      cardsToIds.set(card, list);
    });

    for (const [card, ids] of cardsToIds.entries()) {
      if (!ids.length) {
      await req.db.query("DELETE FROM offers WHERE user_id = ? AND card_last5 = ?", [
        req.user.id,
        card
      ]);
      continue;
    }
    const placeholders = ids.map(() => "?").join(", ");
    await req.db.query(
      `DELETE FROM offers WHERE user_id = ? AND card_last5 = ? AND id NOT IN (${placeholders})`,
      [req.user.id, card, ...ids]
    );
  }

    res.json({ ok: true, count: values.length });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
