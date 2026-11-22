// Temporary password for an admin-triggered reset. Generated in the browser so nothing fixed
// ships in the bundle, and the alphabet drops 0/O/o and 1/l/I so it survives being read aloud.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGIT = '23456789';
const SYMBOL = '!@#$%*?-+=';
const ALL = UPPER + LOWER + DIGIT + SYMBOL;

// Rejection sampling keeps every character equally likely; a plain modulo would favour the
// first characters of the alphabet.
function randomIndex(max, rng) {
  const limit = Math.floor(256 / max) * max;
  const byte = new Uint8Array(1);
  for (;;) {
    rng(byte);
    if (byte[0] < limit) return byte[0] % max;
  }
}

const defaultRng = (buf) => globalThis.crypto.getRandomValues(buf);

export const TEMP_PASSWORD_LENGTH = 14;

export function generateTempPassword(length = TEMP_PASSWORD_LENGTH, rng = defaultRng) {
  if (!Number.isInteger(length) || length < 4) throw new Error('length must be an integer >= 4');
  const pick = (set) => set[randomIndex(set.length, rng)];
  // One of each class so the form's checklist (upper, digit, symbol) always passes.
  const chars = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYMBOL)];
  while (chars.length < length) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1, rng);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
