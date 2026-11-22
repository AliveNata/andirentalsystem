const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWhatsapp, parseLookupQuery } = require('../lib/customerLookup');

test('whatsapp 0812, 62812 and +62 812 normalize to the same digits', () => {
  // Act
  const forms = ['081234567890', '6281234567890', '+62 812-3456-7890'].map(normalizeWhatsapp);

  // Assert
  assert.deepEqual(forms, ['6281234567890', '6281234567890', '6281234567890']);
});

test('email is trimmed and lowercased', () => {
  // Act
  const parsed = parseLookupQuery({ email: '  Budi.Santoso@Example.COM ' });

  // Assert
  assert.deepEqual(parsed, { email: 'budi.santoso@example.com', whatsapp: '', empty: false });
});

test('blank, non-digit and non-string parameters count as empty', () => {
  // Act
  const results = [
    parseLookupQuery({}),
    parseLookupQuery({ email: '   ', whatsapp: '' }),
    parseLookupQuery({ whatsapp: 'abc' }),
    parseLookupQuery({ email: ['a@b.c'], whatsapp: { x: '0812' } }),
  ];

  // Assert
  for (const parsed of results) assert.equal(parsed.empty, true);
});
