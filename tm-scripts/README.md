# Tampermonkey Shell (Offers Camp)

This folder holds the minimal userscript shell that loads the main logic.

## Commit

Include:
- `tm-scripts/tampermonkey.js`

## Shell Script

The shell should stay stable and minimal. It loads:
- `http://localhost:5173/offers-camp.js`
- `http://localhost:5173/offers-camp.css`

## Notes

- This is part of the monorepo (`backend/`, `frontend/`, `tm-scripts/`).
- The shell is the portable entry point for new machines.
- Production domain: `offers.camp` (local dev stays on `localhost`).
