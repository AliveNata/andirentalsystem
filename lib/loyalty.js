// One row per customer, counted by lowercased email. The old join matched fact_transaction to
// dim_cust on email+name+whatsapp+address, so every duplicate dim_cust row multiplied the count.
// customer_id alone is not the grouping key either: a booking can create a fresh dim_cust row
// for a returning customer (one email has 39 of them locally), which would split one person
// into dozens of rows. Display fields come from the latest transaction's dim_cust row, or from
// the transaction itself when it predates customer_id (DB/13).
const LOYALTY_SQL = `
  with tx as (
    select ft.id, ft.customer_id, ft.email, ft.name, ft.whatsapp, ft.address, ft.created_at,
           coalesce('email:' || nullif(lower(trim(ft.email)), ''), 'cust:' || ft.customer_id::text, 'tx:' || ft.id::text) as group_key
      from fact_transaction ft
     where ft.deleted = false
  ),
  counted as (
    select group_key, count(*)::int as transaction_count
      from tx
     group by group_key
  ),
  latest as (
    select distinct on (group_key) group_key, customer_id, email, name, whatsapp, address
      from tx
     order by group_key, created_at desc nulls last, id
  )
  -- group_key is unique per row; customer_id is not, since one dim_cust row can sit behind
  -- transactions with different emails.
  select c.group_key,
         l.customer_id,
         coalesce(dc.email, l.email) as email,
         coalesce(dc.name, l.name) as name,
         coalesce(dc.whatsapp, l.whatsapp) as whatsapp,
         coalesce(dc.address, l.address) as address,
         c.transaction_count
    from counted c
    join latest l on l.group_key = c.group_key
    left join dim_cust dc on dc.id = l.customer_id
   order by c.transaction_count desc, name, c.group_key
`;

module.exports = { LOYALTY_SQL };
