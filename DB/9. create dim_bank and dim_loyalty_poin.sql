-- Direkonstruksi dari query dim_bank dan dim_loyalty_poin di index.js (skrip aslinya tidak ada).
CREATE TABLE IF NOT EXISTS dim_bank (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name           TEXT NOT NULL,
  logo_url            TEXT,
  account_number      TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          TEXT
);

-- Satu baris aktif: kode selalu membaca baris terbaru (ORDER BY created_at DESC LIMIT 1).
CREATE TABLE IF NOT EXISTS dim_loyalty_poin (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_point        NUMERIC NOT NULL DEFAULT 0,
  monthly_point      NUMERIC NOT NULL DEFAULT 0,
  point_value        NUMERIC NOT NULL DEFAULT 0,
  min_exchange_point NUMERIC NOT NULL DEFAULT 0,
  created_by         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
