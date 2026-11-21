-- N4: satu booking_code aktif per transaksi, supaya klik ganda reorder tidak membuat transaksi dobel.
-- psql -v ON_ERROR_STOP=1 -v apply=false -f "DB/14. unique booking_code fact_transaction.sql"
-- apply=false menjalankan semua langkah lalu rollback (dry-run). apply=true commit.
\if :{?apply}
\else
  \set apply false
\endif

begin;

-- Baris aktif dengan booking_code yang sama. Yang paling lama (created_at, lalu id) dipertahankan.
select 'duplicates_before' as step, t.id, t.booking_code, t.created_at, t.created_by, t.name,
       row_number() over (partition by t.booking_code order by t.created_at, t.id) as rank_in_code
  from fact_transaction t
 where t.deleted = false
   and t.booking_code in (
         select booking_code
           from fact_transaction
          where deleted = false and booking_code is not null
          group by booking_code
         having count(*) > 1
       )
 order by t.booking_code, rank_in_code;

with ranked as (
  select id,
         row_number() over (partition by booking_code order by created_at, id) as rank_in_code
    from fact_transaction
   where deleted = false and booking_code is not null
),
u as (
  update fact_transaction t
     set deleted = true,
         delete_reason = 'Migrasi 14: duplikat booking_code aktif, transaksi tertua dengan kode yang sama dipertahankan.',
         updated_at = now(),
         updated_by = 'migrasi-14'
    from ranked r
   where r.id = t.id
     and r.rank_in_code > 1
  returning t.id, t.booking_code
)
select 'soft_deleted' as step, id, booking_code from u order by booking_code, id;

create unique index if not exists fact_transaction_booking_code_active_key
    on fact_transaction (booking_code)
 where deleted = false;

select 'duplicates_after' as step, count(*) as rows
  from (
    select booking_code
      from fact_transaction
     where deleted = false and booking_code is not null
     group by booking_code
    having count(*) > 1
  ) d;

\if :apply
commit;
\else
rollback;
\endif
