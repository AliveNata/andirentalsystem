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
| Backend | Node.js, Express, express-session, Multer, Nodemailer, Puppeteer (PDF) |
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

Requirements: Node.js 18 or newer and PostgreSQL.

```bash
# backend
npm install
# create .env with the backend variables listed below
npm start                 # http://localhost:5000

# frontend
cd project
npm install
# create .env with the frontend variables listed below
npm run dev               # http://localhost:5173
```

Run the SQL files in `DB/` against your database to create the tables.

## Environment variables

Backend: `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, `VITE_API_PUBLIC_URL`, `BASE_URL`

Never commit real `.env` files.
