// Counts behind the Welcome cards. $1 is the reference moment (normally now()); the test passes a
// fixed one. "Today" is the Asia/Jakarta calendar date of $1, because the rental runs in WIB and a
// UTC date would roll over at 07:00 local time.
//
// start_date and end_date are DATE columns, compared directly with the Jakarta date. A booking
// without end_date counts as a one-day rental on start_date.
// created_at is TIMESTAMPTZ; the half-open Jakarta-midnight range keeps an index on created_at usable.
// dim_car has no soft-delete column and no per-unit stock, so the third figure is catalogue models.
const DASHBOARD_SUMMARY_SQL = `
  with today as (
    select ($1::timestamptz at time zone 'Asia/Jakarta')::date as d
  )
  select
    (select count(*)::int
       from fact_transaction t
       cross join today
      where not t.deleted
        and t.start_date <= today.d
        and coalesce(t.end_date, t.start_date) >= today.d) as active_rentals,
    (select count(*)::int
       from fact_transaction t
       cross join today
      where not t.deleted
        and t.created_at >= (today.d::timestamp at time zone 'Asia/Jakarta')
        and t.created_at < ((today.d + 1)::timestamp at time zone 'Asia/Jakarta')) as bookings_today,
    (select count(*)::int from dim_car) as car_models
`;

async function getDashboardSummary(db, at = new Date()) {
  const { rows } = await db.query(DASHBOARD_SUMMARY_SQL, [at]);
  return rows[0];
}

module.exports = { DASHBOARD_SUMMARY_SQL, getDashboardSummary };
