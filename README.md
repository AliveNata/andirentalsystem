# Andi Rental System

Internal management system for a car rental business. Staff use it to manage the fleet, take bookings, keep customer records, and send invoices, all from one dashboard.

## Features

- **Fleet management**: add, edit, and archive cars with photos and status
- **Bookings**: customer booking form with identity documents and terms and conditions
- **Customer database**: customer records, payment proof, history log, and delete reason tracking
- **Transactions and invoices**: transaction history, PDF receipts, and invoice emails
- **Loyalty customers**: list of repeat customers
- **Employees and roles**: staff accounts with login and access levels
- **Activity log** and a reorderable dashboard

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Radix UI, React Router |
| Backend | Node.js, Express, express-session with connect-pg-simple, Multer, Nodemailer |
| Database | PostgreSQL (pg, Prisma schema), Supabase for storage and an email edge function |

## Project structure

```
index.js          # Express API (auth, cars, customers, uploads, invoices)
db.js             # PostgreSQL pool
server/           # route modules, auth middleware, PDF generator, setup scripts
prisma/           # Prisma schema
DB/               # SQL scripts for tables and policies
project/          # React frontend (Vite)
    src/components/
    supabase/     # migrations and edge function
```

## Getting started

Requirements: Node.js 24 LTS and PostgreSQL 18.

```bash
# backend
npm install
# create .env with the backend variables listed below
npm start                 # http://localhost:5000

# frontend
cd project
npm install
# create .env with the frontend variables listed below
npm run dev               # http://localhost:5180
```

Run the SQL files in `DB/` against your database to create the tables, including `DB/16. create app_session.sql` for login sessions.

## Environment variables

Backend (see `.env.example`):

| Variable | Required | Notes |
|---|---|---|
| `PORT` | yes | The server exits on start when it is empty |
| `NODE_ENV` | production | `production` turns on the secure cookie |
| `SESSION_SECRET` | yes | At least 32 characters |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | yes | PostgreSQL connection |
| `ALLOWED_ORIGINS` | production | Comma list of exact origins, e.g. `https://rentcar.example.com`, no trailing slash. Development defaults to `http://localhost:5173,http://localhost:5180` |
| `TRUST_PROXY` | behind a proxy | Proxy hop count, `1` behind nginx. Needed for the secure cookie |
| `SESSION_TABLE` | no | Defaults to `app_session` |
| `UPLOAD_DIR` | production | Defaults to `./uploads` |
| `EMAIL_USER`, `EMAIL_PASS` | yes | Gmail SMTP with an App Password |

Frontend: `VITE_API_URL` is optional and defaults to `/api`, which is what the same-domain deploy uses.

Never commit real `.env` files.

## Production

The app runs in Docker behind the host nginx: nginx serves `project/dist` and proxies `/api` to the backend. `GET /api/health` returns 200 when the database answers within 2 seconds and 503 otherwise. Deploy steps, backups and rollback are in `deploy/RUNBOOK.md`.
