import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateTempPassword, TEMP_PASSWORD_LENGTH } from '../project/src/lib/tempPassword.mjs';

// Same rule as the employee form checklist in EmployeeManagement.tsx.
const FORM_RULE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

test('temp password is 14 chars, passes the form rule and avoids look-alike characters', () => {
  // Arrange
  const runs = 500;

  // Act
  const passwords = Array.from({ length: runs }, () => generateTempPassword());

  // Assert
  for (const pw of passwords) {
    assert.equal(pw.length, TEMP_PASSWORD_LENGTH);
    assert.match(pw, FORM_RULE);
    assert.match(pw, /[a-z]/);
    assert.doesNotMatch(pw, /[0O1lIo]/);
  }
  assert.equal(new Set(passwords).size, runs);
});

test('bytes outside the unbiased range are discarded, not folded with modulo', () => {
  // Arrange: 255 is above floor(256/24)*24 = 240 for the 24-letter upper set, so it must be skipped.
  const bytes = [255, 0];
  const calls = [];
  const rng = (buf) => { const b = bytes.length ? bytes.shift() : 0; calls.push(b); buf[0] = b; };

  // Act
  const pw = generateTempPassword(4, rng);

  // Assert
  assert.equal(calls[0], 255);
  assert.equal(pw.length, 4);
  assert.match(pw, /A/);
});

test('length below 4 cannot hold one of each class and is rejected', () => {
  // Arrange + Act + Assert
  assert.throws(() => generateTempPassword(3), /length/);
});
