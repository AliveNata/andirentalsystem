type Amount = number | string | null | undefined;

export interface TotalsInput {
  rental_cost: Amount;
  deposit?: Amount;
  discount?: Amount;
  needs_trip?: boolean;
  needs_driver?: boolean;
  needs_delivery?: boolean;
  needs_pickup?: boolean;
  trip_fee?: Amount;
  driver_fee?: Amount;
  delivery_fee?: Amount;
  pickup_fee?: Amount;
}

export interface Totals {
  rental_cost: number;
  discount_applied: number;
  rental_after_discount: number;
  trip_fee: number;
  driver_fee: number;
  delivery_fee: number;
  pickup_fee: number;
  services_total: number;
  /** rental_after_discount + services_total (grand_total without the deposit). */
  subtotal: number;
  deposit: number;
  total_before_discount: number;
  grand_total: number;
}

/** Throws TypeError when rental_cost is missing or any amount is not a finite number. */
export function computeTotals(input: TotalsInput): Totals;
