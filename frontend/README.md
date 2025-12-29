# Frontend (React + Vite)

This is the UI for searching and viewing offers.
Production domain: `offers.camp` (local dev stays on `localhost`).

## Commit

Include:
- `frontend/src/`
- `frontend/public/` (must include `offers-core.js`, `offers-auth.js`, `offers-utils.js`, `offers-config.js`, `offers-camp.css`, and `providers/*`)
- `frontend/index.html`
- `frontend/vite.config.js`
- `frontend/package.json`
- `frontend/package-lock.json`

Exclude:
- `frontend/node_modules`
- `frontend/dist`

## Notes

- `frontend/public/offers-core.js` is the Tampermonkey runtime core.
- `frontend/public/offers-auth.js` handles login/token flow.
- `frontend/public/offers-utils.js` contains shared helpers.
- `frontend/public/offers-config.js` controls environment endpoints.
- `frontend/public/offers-camp.css` is loaded by the shell userscript.
