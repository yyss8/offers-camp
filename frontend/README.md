# Frontend (React + Vite)

This is the UI for searching and viewing offers.
Production domain: `offers.camp` (local dev stays on `localhost`).

## Commit

Include:
- `frontend/src/`
- `frontend/public/` (must include `main.js` and `offers-camp.css`)
- `frontend/index.html`
- `frontend/vite.config.js`
- `frontend/package.json`
- `frontend/package-lock.json`

Exclude:
- `frontend/node_modules`
- `frontend/dist`

## Notes

- `frontend/public/offers-camp.js` is the Tampermonkey runtime entry and must be committed.
- `frontend/public/offers-camp.css` is loaded by the shell userscript.
