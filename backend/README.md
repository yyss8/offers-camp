# Backend (Express + MySQL) - Offers Camp

This is the API layer for the offers collector.

## To create new user:
```curl
curl -X POST http://localhost:4000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "username": "example",
       "email": "email@example.com",
       "password": "password"
     }'
```

## Notes

- This service is part of a monorepo (`backend/`, `frontend/`, `tm-scripts/`).
- Keep API and data model in sync with `frontend/public/offers-camp.js` (Tampermonkey main logic).
- Production domain: `offers.camp` (local dev stays on `localhost`).
