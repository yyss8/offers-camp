# 🏕️ Offers Camp Self-Hosting Guide

[中文教程](SELF-HOSTING-ZH.md)

This document explains how to run **Offers Camp** on your own machine or VPS.
Self‑hosting is a first‑class option and gives you full control over your data.

---

## Architecture Overview

```
Tampermonkey Collector
        ↓
 Offers Camp API (Node / Express)
        ↓
      MySQL
        ↓
 Offers Camp Web Dashboard
```

You can run everything locally for development, or deploy the same setup to a VPS.

---

## Prerequisites

- Node.js 20.0+
- MySQL 8.0+
- npm
- A modern browser with Tampermonkey installed

---

### Environment Variables

Edit `.env` based on `.env.example`:

```env
PORT=4000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=offerscamp
DB_PASSWORD=change-me
DB_NAME=offers_camp

SESSION_SECRET=change-me
FRONTEND_ORIGIN=http://localhost:5173
```

---

## Database Setup (MySQL)

Create the database and tables using the provided schema:

```bash
mysql -u root -p < backend/sql/schema.sql
```

### Schema Notes

- `offers` table stores de‑duplicated offers per user and card
- Composite primary key prevents duplicate uploads
- JSON columns are used for categories and channels
- Charset is `utf8mb4` for full Unicode support

---

## Backend (API) Setup

From the repository root:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The API will be available at:

```
http://localhost:4000
```

---

## Frontend (Dashboard) Setup

From the repository root:

```bash
cd frontend
npm install
npm run dev
```

The web UI will be available at:

```
http://localhost:5173
```

Once running, you can log in and browse offers synced from the Tampermonkey script.

---

## Using local Tampermonkey script files for local development or maximum privacy

1. Open the installed Offers Camp userscript in Tampermonkey.
2. Replace its contents with `tampermonkey.dev.js` located in the root of the repo.
3. Make sure the `@require` entries point to your local frontend endpoint (e.g. `http://localhost:5173`).
4. Update API endpoints in `frontend\public\tm\js\offers-config.js` config file used by the Tampermonkey script.

---

## Production Deployment Notes

When deploying to a VPS:

- Make sure ``frontend\public\tm\js\offers-config.js` points to your public API domain.
- Make sure `FRONTEND_ORIGIN` points to your public frontend domain.

---

## Summary

Self‑hosting Offers Camp gives you:

- Full data ownership
- Mobile‑friendly offer browsing
- No dependency on third‑party plugin servers
- A clean separation between collection and viewing

Cloud is optional. Control is not.

---
