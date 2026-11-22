-- history_log jadi log aktivitas umum untuk semua entitas (dulu kode memakai history_log_v1).
-- log_id dan user_id bertipe TEXT karena kode kadang mengirim id, kadang username.
ALTER TABLE history_log ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE history_log ADD COLUMN IF NOT EXISTS log_id  TEXT;
ALTER TABLE history_log ADD COLUMN IF NOT EXISTS entity  TEXT;
ALTER TABLE history_log ADD COLUMN IF NOT EXISTS page    TEXT;
ALTER TABLE history_log ADD COLUMN IF NOT EXISTS user_id TEXT;
CREATE INDEX IF NOT EXISTS history_log_log_id_entity_idx ON history_log (log_id, entity);
CREATE INDEX IF NOT EXISTS history_log_created_at_idx ON history_log (created_at DESC);

-- Trigger lama dari era Supabase. Kode sudah mencatat perubahan customer sendiri,
-- jadi kalau trigger tetap aktif setiap perubahan tercatat dua kali.
-- Fungsinya dibiarkan agar trigger bisa dipasang lagi bila perlu.
DROP TRIGGER IF EXISTS log_customer_changes_trigger ON dim_cust;
