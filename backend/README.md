# Backend (Express + MySQL) - Offers Camp

This is the API layer for the offers collector.

## Commit

Include:
- `backend/src/`
- `backend/sql/`
- `backend/package.json`
- `backend/package-lock.json`
- `backend/.env.example`

Exclude:
- `backend/node_modules`
- `backend/.env`

## Notes

- This service is part of a monorepo (`backend/`, `frontend/`, `tm-scripts/`).
- Keep API and data model in sync with `frontend/public/offers-camp.js` (Tampermonkey main logic).
- Production domain: `offers.camp` (local dev stays on `localhost`).
