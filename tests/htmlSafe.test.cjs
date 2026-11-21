const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  escapeHtml, safeUrl, safeImageUrl, formatRupiah, formatDateId, formatTimeId, safeSubject,
} = require('../project/src/components/emailTemplates/htmlSafe.cjs');

const PAYLOAD = '<b>QA</b><img src=x onerror=alert(1)>';

test('escapeHtml neutralises tags and quotes', () => {
  // Arrange
  const value = `${PAYLOAD}"'&`;

  // Act
  const out = escapeHtml(value);

  // Assert
  assert.ok(out.includes('&lt;b&gt;'));
  assert.ok(!out.includes('<img'));
  assert.ok(out.endsWith('&quot;&#39;&amp;'));
  assert.equal(escapeHtml(null), '');
});

test('safeUrl only allows http and https', () => {
  // Arrange
  const cases = ['javascript:alert(1)', 'data:text/html,x', '', 'not a url', null];

  // Act
  const results = cases.map(safeUrl);

  // Assert
  results.forEach((r) => assert.equal(r, null));
  assert.equal(safeUrl('https://example.com/a.png?x=1&y=2'), 'https://example.com/a.png?x=1&amp;y=2');
});

test('date and time format in Indonesian without a time zone shift', () => {
  // Arrange
  const date = '2026-11-23';

  // Act
  const formatted = formatDateId(date);

  // Assert
  assert.equal(formatted, '23 November 2026');
  assert.equal(formatTimeId('09:00:00'), '09.00 WIB');
  assert.equal(formatTimeId(null), '');
});

test('safeSubject strips line breaks', () => {
  // Arrange
  const code = 'QA-1\r\nBcc: x@example.com';

  // Act
  const subject = safeSubject(code);

  // Assert
  assert.ok(!/[\r\n]/.test(subject));
});

test('formatRupiah writes Rp with no space and dot thousands', () => {
  // Arrange
  const values = [1500000, '400000', 0, null];

  // Act
  const out = values.map(formatRupiah);

  // Assert
  assert.deepEqual(out, ['Rp1.500.000', 'Rp400.000', 'Rp0', 'Rp0']);
});

test('safeImageUrl accepts https only', () => {
  // Arrange
  const cases = ['http://example.com/logo.png', 'javascript:alert(1)', 'https://example.com/logo.png'];

  // Act
  const out = cases.map(safeImageUrl);

  // Assert
  assert.deepEqual(out, [null, null, 'https://example.com/logo.png']);
});
