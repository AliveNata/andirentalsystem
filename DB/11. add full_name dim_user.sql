-- full_name dipakai menu Karyawan (GET/POST/PUT /api/employees di index.js) tapi belum ada di dim_user.
ALTER TABLE dim_user ADD COLUMN IF NOT EXISTS full_name TEXT;
UPDATE dim_user SET full_name = 'Super Admin' WHERE username = 'andirental' AND full_name IS NULL;
