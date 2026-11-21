-- K5, K8: relasi transaksi ke customer, biaya sewa sebagai kolom sendiri, log kirim receipt.
-- psql -v ON_ERROR_STOP=1 -v apply=false -f "DB/13. add customer_id and rental_cost fact_transaction.sql"
-- apply=false menjalankan semua langkah lalu rollback (dry-run). apply=true commit.
\if :{?apply}
\else
  \set apply false
\endif

begin;

alter table fact_transaction add column if not exists customer_id uuid;
alter table fact_transaction add column if not exists rental_cost numeric;
alter table fact_transaction add column if not exists receipt_logs jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fact_transaction_customer_id_fkey') then
    alter table fact_transaction
      add constraint fact_transaction_customer_id_fkey
      foreign key (customer_id) references dim_cust (id) on delete restrict;
  end if;
end $$;

create index if not exists fact_transaction_customer_id_idx on fact_transaction (customer_id);

select 'before' as step, count(*) as total, count(customer_id) as with_customer, count(rental_cost) as with_rental_cost
  from fact_transaction;

-- Langkah 3: cocokkan lewat booking_code (dim_cust.booking_code unik, jadi kandidat paling banyak satu).
with u as (
  update fact_transaction t
     set customer_id = c.id
    from dim_cust c
   where t.customer_id is null
     and coalesce(t.booking_code, '') <> ''
     and c.booking_code = t.booking_code
  returning 1
)
select 'customer_id_by_booking_code' as step, count(*) as rows from u;

-- Langkah 4: sisanya lewat email, hanya bila kandidatnya tepat satu customer.
with candidates as (
  select t.id as transaction_id,
         min(c.id::text)::uuid as customer_id,
         count(*) as candidate_count
    from fact_transaction t
    join dim_cust c
      on lower(trim(c.email)) = lower(trim(t.email))
   where t.customer_id is null
     and coalesce(trim(t.email), '') <> ''
   group by t.id
),
u as (
  update fact_transaction t
     set customer_id = cand.customer_id
    from candidates cand
   where cand.transaction_id = t.id
     and cand.candidate_count = 1
  returning 1
)
select 'customer_id_by_unique_email' as step, count(*) as rows from u;

-- Langkah 7: biaya yang flag-nya mati disimpan 0 (dijalankan sebelum backfill supaya backfill cukup mengurangi semua fee).
with u as (
  update fact_transaction
     set trip_fee     = case when needs_trip     then trip_fee     else 0 end,
         driver_fee   = case when needs_driver   then driver_fee   else 0 end,
         delivery_fee = case when needs_delivery then delivery_fee else 0 end,
         pickup_fee   = case when needs_pickup   then pickup_fee   else 0 end
   where (not needs_trip and trip_fee <> 0)
      or (not needs_driver and driver_fee <> 0)
      or (not needs_delivery and delivery_fee <> 0)
      or (not needs_pickup and pickup_fee <> 0)
  returning 1
)
select 'inactive_fees_zeroed' as step, count(*) as rows from u;

-- Langkah 6: rental_cost = kebalikan rumus opsi A. Hanya bila hasilnya tunggal:
-- net > 0 berarti diskon < biaya sewa (tidak terpotong). net = 0 dengan diskon 0 berarti sewa 0. Selain itu NULL.
with net as (
  select id,
         grand_total - deposit - trip_fee - driver_fee - delivery_fee - pickup_fee as net_rental
    from fact_transaction
   where rental_cost is null
     and range_rent > 0
     and deposit >= 0 and discount >= 0
     and trip_fee >= 0 and driver_fee >= 0 and delivery_fee >= 0 and pickup_fee >= 0
),
u as (
  update fact_transaction t
     set rental_cost = case when n.net_rental > 0 then n.net_rental + t.discount else 0 end
    from net n
   where n.id = t.id
     and (n.net_rental > 0 or (n.net_rental = 0 and t.discount = 0))
  returning 1
)
select 'rental_cost_backfilled' as step, count(*) as rows from u;

-- Cek wajib: keduanya harus 0.
select 'check_booking_code_mismatch' as step, count(*) as rows
  from fact_transaction t
  join dim_cust c on c.booking_code = t.booking_code
 where t.customer_id is distinct from c.id;

select 'check_total_mismatch' as step, count(*) as rows
  from fact_transaction
 where rental_cost is not null
   and grand_total <> rental_cost - least(discount, rental_cost)
                      + trip_fee + driver_fee + delivery_fee + pickup_fee + deposit;

-- Daftar baris yang dibiarkan NULL beserta alasannya.
select 'null_customer_id' as step, t.id, coalesce(t.booking_code, '<kosong>') as booking_code, t.created_by,
       case when coalesce(trim(t.email), '') = '' then 'email kosong'
            else 'kandidat email: ' || (select count(*) from dim_cust c where lower(trim(c.email)) = lower(trim(t.email)))
       end as reason
  from fact_transaction t
 where t.customer_id is null
 order by t.created_at;

select 'null_rental_cost' as step, id, coalesce(booking_code, '<kosong>') as booking_code, created_by,
       range_rent, grand_total, deposit, discount
  from fact_transaction
 where rental_cost is null
 order by created_at;

select 'after' as step, count(*) as total, count(customer_id) as with_customer, count(rental_cost) as with_rental_cost
  from fact_transaction;

\if :apply
commit;
\else
rollback;
\endif
