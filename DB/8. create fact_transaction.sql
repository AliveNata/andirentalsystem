-- Direkonstruksi dari query fact_transaction di index.js (skrip aslinya tidak ada).
-- Kolom yang sama dengan dim_cust memakai tipe yang sama.
CREATE TABLE IF NOT EXISTS fact_transaction (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code     TEXT,
  email            TEXT,
  rental_duration  TEXT,
  range_rent       NUMERIC NOT NULL DEFAULT 0,
  car_type         TEXT,
  needs_trip       BOOLEAN NOT NULL DEFAULT false,
  needs_driver     BOOLEAN NOT NULL DEFAULT false,
  needs_delivery   BOOLEAN NOT NULL DEFAULT false,
  needs_pickup     BOOLEAN NOT NULL DEFAULT false,
  start_date       DATE,
  start_time       TIME,
  end_date         DATE,
  grand_total      NUMERIC NOT NULL DEFAULT 0,
  deposit          NUMERIC NOT NULL DEFAULT 0,
  discount         NUMERIC NOT NULL DEFAULT 0,
  trip_fee         NUMERIC NOT NULL DEFAULT 0,
  driver_fee       NUMERIC NOT NULL DEFAULT 0,
  delivery_fee     NUMERIC NOT NULL DEFAULT 0,
  pickup_fee       NUMERIC NOT NULL DEFAULT 0,
  purpose          TEXT,
  identity_type    TEXT,
  name             TEXT,
  whatsapp         TEXT,
  address          TEXT,
  company_address  TEXT,
  -- Bukti bayar: { filename, mimetype } atau null
  deposit_payment  JSONB,
  down_payment     JSONB,
  full_payment     JSONB,
  lunas            BOOLEAN NOT NULL DEFAULT false,
  -- Daftar waktu (ISO string) invoice dikirim
  invoice_logs     JSONB NOT NULL DEFAULT '[]',
  deleted          BOOLEAN NOT NULL DEFAULT false,
  delete_reason    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       TEXT
);
CREATE INDEX IF NOT EXISTS fact_transaction_booking_code_idx ON fact_transaction (booking_code);
