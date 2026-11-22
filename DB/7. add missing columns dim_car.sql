-- Kolom yang dipakai POST/PUT /api/cars di index.js tapi belum ada di dim_car.
-- image, colors, plates disimpan sebagai teks JSON karena frontend selalu JSON.parse nilainya.
ALTER TABLE dim_car ADD COLUMN IF NOT EXISTS deposit    NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE dim_car ADD COLUMN IF NOT EXISTS colors     TEXT    NOT NULL DEFAULT '[]';
ALTER TABLE dim_car ADD COLUMN IF NOT EXISTS plates     TEXT    NOT NULL DEFAULT '[]';
ALTER TABLE dim_car ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE dim_car ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE dim_car ALTER COLUMN image SET DEFAULT '[]';
UPDATE dim_car SET image = '[]' WHERE image IS NULL;
