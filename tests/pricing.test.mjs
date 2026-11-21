import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTotals } from '../project/src/lib/pricing.mjs';

test('AC-K8-1 example: inactive delivery fee is ignored, deposit is in the total', () => {
  // Arrange
  const input = {
    rental_cost: 1000000, deposit: 400000, discount: 100000,
    needs_driver: true, driver_fee: 200000,
    needs_delivery: false, delivery_fee: 150000,
  };

  // Act
  const totals = computeTotals(input);

  // Assert
  assert.equal(totals.discount_applied, 100000);
  assert.equal(totals.delivery_fee, 0);
  assert.equal(totals.services_total, 200000);
  assert.equal(totals.grand_total, 1500000);
});

test('discount is capped at the rental cost and never touches services', () => {
  // Arrange
  const input = { rental_cost: 300000, discount: 500000, deposit: 0, needs_pickup: true, pickup_fee: 50000 };

  // Act
  const totals = computeTotals(input);

  // Assert
  assert.equal(totals.discount_applied, 300000);
  assert.equal(totals.rental_after_discount, 0);
  assert.equal(totals.grand_total, 50000);
});

test('seed row with numeric strings from pg matches the stored grand total', () => {
  // Arrange
  const row = {
    rental_cost: '400000', deposit: '500000', discount: '0',
    needs_trip: false, needs_driver: false, needs_delivery: false, needs_pickup: false,
    trip_fee: '0', driver_fee: '0', delivery_fee: '0', pickup_fee: '0',
  };

  // Act
  const totals = computeTotals(row);

  // Assert
  assert.equal(totals.grand_total, 900000);
});

test('flag must be boolean true; the string "true" does not count', () => {
  // Arrange
  const input = { rental_cost: 100, needs_trip: 'true', trip_fee: 50 };

  // Act
  const totals = computeTotals(input);

  // Assert
  assert.equal(totals.trip_fee, 0);
  assert.equal(totals.grand_total, 100);
});

test('missing rental_cost and non-numeric amounts throw TypeError', () => {
  // Arrange
  const missing = { deposit: 100 };
  const notNumber = { rental_cost: 100, deposit: 'abc' };

  // Act and Assert
  assert.throws(() => computeTotals(missing), TypeError);
  assert.throws(() => computeTotals(notNumber), TypeError);
});

test('subtotal is rental after discount plus active services, without the deposit', () => {
  // Arrange
  const input = {
    rental_cost: 1000000, deposit: 400000, discount: 100000,
    needs_driver: true, driver_fee: 200000,
    needs_delivery: false, delivery_fee: 150000,
    needs_trip: true, trip_fee: 0,
  };

  // Act
  const totals = computeTotals(input);

  // Assert
  assert.equal(totals.subtotal, 1100000);
  assert.equal(totals.grand_total, totals.subtotal + totals.deposit);
});

test('every inactive fee is 0 even when the form still holds a value', () => {
  // Arrange
  const input = {
    rental_cost: 500000,
    needs_trip: false, trip_fee: 1,
    needs_driver: false, driver_fee: 2,
    needs_delivery: false, delivery_fee: 3,
    needs_pickup: false, pickup_fee: 4,
  };

  // Act
  const totals = computeTotals(input);

  // Assert
  assert.deepEqual(
    [totals.trip_fee, totals.driver_fee, totals.delivery_fee, totals.pickup_fee, totals.services_total],
    [0, 0, 0, 0, 0],
  );
  assert.equal(totals.subtotal, 500000);
});
