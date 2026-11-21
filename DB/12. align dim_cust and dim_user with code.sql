-- dim_cust: kode sekarang hanya menyimpan identitas customer; data booking ada di fact_transaction.
-- Kolom booking lama tetap ada untuk data lama, tapi tidak lagi wajib diisi.
ALTER TABLE dim_cust ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE dim_cust ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE dim_cust ALTER COLUMN booking_code    DROP NOT NULL;
ALTER TABLE dim_cust ALTER COLUMN rental_duration DROP NOT NULL;
ALTER TABLE dim_cust ALTER COLUMN car_type        DROP NOT NULL;
ALTER TABLE dim_cust ALTER COLUMN start_date      DROP NOT NULL;
ALTER TABLE dim_cust ALTER COLUMN start_time      DROP NOT NULL;
ALTER TABLE dim_cust ALTER COLUMN end_date        DROP NOT NULL;
ALTER TABLE dim_cust ALTER COLUMN purpose         DROP NOT NULL;
ALTER TABLE dim_cust ALTER COLUMN needs_driver    SET DEFAULT false;
ALTER TABLE dim_cust ALTER COLUMN needs_delivery  SET DEFAULT false;

-- dim_user: level 'manajemen' divalidasi di index.js dan ada di dropdown Karyawan.
ALTER TABLE dim_user DROP CONSTRAINT IF EXISTS dim_user_level_check;
ALTER TABLE dim_user ADD CONSTRAINT dim_user_level_check
  CHECK (level IN ('superadmin', 'admin', 'manajemen'));
