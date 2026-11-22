-- Login role for the app (DB_USER in the app container), separate from the owner/superuser role
-- used for migrations and backups. The app gets data access only: no DDL, no role management.
--
-- Run as the superuser (POSTGRES_USER), after every other migration and after the data restore:
--   psql -v ON_ERROR_STOP=1 -v app_password=<hex> -f "DB/17. create app role.sql"
-- Optional: -v app_role=<name> (default armj_app). Safe to run again; a rerun also resets the password.
--
-- RLS: dim_user, dim_car, dim_cust and history_log have RLS enabled. Until now the app connected as
-- the table owner, which skips RLS. The policies are Supabase leftovers (auth.jwt() always returns
-- superadmin) and dim_cust has no UPDATE policy, so the app's UPDATE dim_cust would match 0 rows
-- if RLS applied to it. BYPASSRLS keeps the current behaviour; granting `authenticated` would not.

\set ON_ERROR_STOP on

\if :{?app_password}
\else
  do $$ begin raise exception 'app_password is not set: run psql with -v app_password=<hex>'; end $$;
\endif

\if :{?app_role}
\else
  \set app_role armj_app
\endif

select format('create role %I', :'app_role')
where not exists (select 1 from pg_roles where rolname = :'app_role')
\gexec

alter role :"app_role" with login nosuperuser nocreatedb nocreaterole noinherit noreplication bypassrls
  password :'app_password';

select format('grant connect on database %I to %I', current_database(), :'app_role') \gexec

revoke create on schema public from public;
grant usage on schema public to :"app_role";

grant select, insert, update, delete on all tables in schema public to :"app_role";
grant usage, select on all sequences in schema public to :"app_role";

-- The app only inserts and reads audit rows; no update or delete, so a compromised app cannot erase the trail.
revoke update, delete on history_log from :"app_role";

-- Tables and sequences created later by the role running this file (the owner) get the same grants.
alter default privileges in schema public
  grant select, insert, update, delete on tables to :"app_role";
alter default privileges in schema public
  grant usage, select on sequences to :"app_role";
