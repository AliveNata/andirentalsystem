-- Session login disimpan di Postgres (connect-pg-simple) supaya restart app tidak memaksa
-- semua user login ulang. Nama tabel harus sama dengan SESSION_TABLE (default app_session).
-- psql -v ON_ERROR_STOP=1 -f "DB/16. create app_session.sql"
-- Aman dijalankan ulang.

create table if not exists app_session (
  sid    varchar      not null primary key,
  sess   json         not null,
  expire timestamp(6) not null
);
create index if not exists app_session_expire_idx on app_session (expire);
