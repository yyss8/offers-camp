# Offers Camp

Search credit card merchant offers across multiple banks, powered by Tampermonkey + Node.js + React.

## What This Is

Personal tool to:

- Collect merchant offers from multiple card portals (Amex, Chase, Citi, etc.)
- Normalize offers into a single backend
- Browse and search offers from one UI

Core idea: Tampermonkey reads what you already see, backend stores it, frontend lets you search it.

## Repo Structure

```
backend/
frontend/
tm-scripts/
```

## Local Dev

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- TM assets served from `frontend/public/`

Tampermonkey shell (local): `tm-scripts/tampermonkey.js`

## VPS (Caddy)

```
app.offers.camp {
  file_server
}

api.offers.camp {
  reverse_proxy localhost:4000
}

tm.offers.camp {
  file_server
}
```

On VPS, update `tm.offers.camp/offers-config.js`:

```js
window.OffersCampConfig = {
  appBase: "https://app.offers.camp",
  apiBase: "https://api.offers.camp",
  tmBase: "https://tm.offers.camp"
};
```

Tampermonkey shell (prod): `tm-scripts/tampermonkey.prod.js`
