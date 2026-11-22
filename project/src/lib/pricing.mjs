// Single source for the booking total (user decision K8 option A). The backend
// require()s this file and the frontend imports it, so it must stay plain ESM.

const FEES = [
  ['needs_trip', 'trip_fee'],
  ['needs_driver', 'driver_fee'],
  ['needs_delivery', 'delivery_fee'],
  ['needs_pickup', 'pickup_fee'],
];

function toAmount(value, name, required = false) {
  if (value === null || value === undefined || value === '') {
    if (required) throw new TypeError(`${name} wajib diisi`);
    return 0;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw new TypeError(`${name} bukan angka`);
  return n;
}

// Input uses DB column names so a fact_transaction row can be passed as is.
// Flags must be boolean true: convert multipart 'true' strings before calling.
export function computeTotals(input) {
  const rental_cost = toAmount(input.rental_cost, 'rental_cost', true);
  const deposit = toAmount(input.deposit, 'deposit');
  const discount_applied = Math.min(toAmount(input.discount, 'discount'), rental_cost);
  const fees = {};
  for (const [flag, key] of FEES) {
    fees[key] = input[flag] === true ? toAmount(input[key], key) : 0;
  }
  const services_total = fees.trip_fee + fees.driver_fee + fees.delivery_fee + fees.pickup_fee;
  const rental_after_discount = rental_cost - discount_applied;
  const subtotal = rental_after_discount + services_total;
  return {
    rental_cost,
    discount_applied,
    rental_after_discount,
    ...fees,
    services_total,
    // Rental after discount plus active services, i.e. everything except the refundable deposit.
    subtotal,
    deposit,
    // Only for a discount percentage on admin screens, never shown as a total.
    total_before_discount: rental_cost + services_total + deposit,
    grand_total: subtotal + deposit,
  };
}
