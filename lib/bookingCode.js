const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SUFFIX_LENGTH = 4;
const MAX_ATTEMPTS = 5;
const BOOKING_CODE_RE = /^ARMJ\d{8}[A-Z0-9]{4}$/;
// Both unique keys carry booking_code, so a 23505 on either one means the random suffix collided.
const BOOKING_CODE_KEYS = new Set(['dim_cust_booking_code_key', 'fact_transaction_booking_code_active_key']);

// en-CA formats as YYYY-MM-DD; the zone is fixed so the server and DB clock zones never shift the date.
const JAKARTA_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
});

function jakartaDateStamp(now = new Date()) {
  const parts = Object.fromEntries(JAKARTA_DATE.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}${parts.month}${parts.day}`;
}

function generateBookingCode(now = new Date(), randomInt = crypto.randomInt) {
  let suffix = '';
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `ARMJ${jakartaDateStamp(now)}${suffix}`;
}

function isBookingCodeConflict(err) {
  return err?.code === '23505' && BOOKING_CODE_KEYS.has(err.constraint);
}

// Runs insert(code) inside a savepoint so a collision undoes only this attempt, not the open transaction.
// After MAX_ATTEMPTS collisions the last 23505 is rethrown for the caller to answer 409.
async function withBookingCode(client, insert, { generate = generateBookingCode, attempts = MAX_ATTEMPTS } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    const code = generate();
    await client.query('savepoint booking_code_attempt');
    try {
      const result = await insert(code);
      await client.query('release savepoint booking_code_attempt');
      return result;
    } catch (err) {
      if (!isBookingCodeConflict(err)) throw err;
      await client.query('rollback to savepoint booking_code_attempt');
      lastErr = err;
    }
  }
  throw lastErr;
}

module.exports = {
  BOOKING_CODE_RE,
  BOOKING_CODE_KEYS,
  MAX_ATTEMPTS,
  jakartaDateStamp,
  generateBookingCode,
  isBookingCodeConflict,
  withBookingCode,
};
