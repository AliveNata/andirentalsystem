-- dim_web_config: konfigurasi web (logo, dll).
-- Dipakai endpoint /api/web-config* di index.js. Daftar kunci ada di lib/webConfig.js, kolom value_text dari migrasi 15.
CREATE TABLE IF NOT EXISTS dim_web_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT,
  url_image   TEXT,
  created_by  TEXT,
  updated_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
