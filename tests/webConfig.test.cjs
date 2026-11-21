const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseWebConfigInput, rowsToConfig, publicConfig, signatoryFrom, TEXT_MAX,
} = require('../lib/webConfig');
const { PUBLIC_API, apiGate } = require('../lib/auth');
const { SIGNATORY } = require('../project/src/components/emailTemplates/brand.cjs');
const { generateReceiptEmail, generateReceiptText } = require('../project/src/components/emailTemplates/receiptTemplate.cjs');
const { computeTotals } = require('../project/src/lib/pricing.mjs');

test('valid input is trimmed and blank values become null (remove the row)', () => {
  // Act
  const parsed = parseWebConfigInput({
    logo: '  https://cdn.example.com/logo.png ',
    favicon: '',
    signature: null,
    signatoryName: '  Nama Uji ',
    signatoryTitle: '   ',
  });

  // Assert
  assert.deepEqual(parsed, {
    values: {
      logo: 'https://cdn.example.com/logo.png',
      favicon: null,
      signature: null,
      signatoryName: 'Nama Uji',
      signatoryTitle: null,
    },
  });
});

test('unknown keys, empty bodies and non-objects are rejected', () => {
  // Act
  const results = [
    parseWebConfigInput({ logo: 'https://a.example/x.png', description: 'Logo' }),
    parseWebConfigInput({}),
    parseWebConfigInput(null),
    parseWebConfigInput(['logo']),
    parseWebConfigInput({ __proto__: { logo: 'x' } }),
  ];

  // Assert
  for (const parsed of results) assert.equal(typeof parsed.error, 'string');
  assert.match(results[0].error, /description/);
});

test('url keys only accept https, because the email templates drop http images', () => {
  // Act
  const bad = ['http://a.example/x.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://a.example/x.png', 'logo.png']
    .map((v) => parseWebConfigInput({ favicon: v }));
  const good = parseWebConfigInput({ signature: 'https://a.example/ttd.png' });

  // Assert
  for (const parsed of bad) assert.equal(parsed.error, 'URL Favicon harus diawali https://.');
  assert.equal(good.values.signature, 'https://a.example/ttd.png');
});

test('text keys reject control characters such as tab, newline and DEL', () => {
  // Act
  const results = ['Nama\tUji', 'Nama\nUji', 'Nama\u0000', 'Nama\u007F'].map((v) => parseWebConfigInput({ signatoryName: v }));
  const plain = parseWebConfigInput({ signatoryName: 'Nama Uji, S.E.' });

  // Assert
  for (const parsed of results) assert.match(parsed.error, /karakter yang tidak diizinkan/);
  assert.equal(plain.values.signatoryName, 'Nama Uji, S.E.');
});

test('text keys reject non-strings and anything over the length limit', () => {
  // Act
  const atLimit = parseWebConfigInput({ signatoryTitle: 'x'.repeat(TEXT_MAX) });
  const overLimit = parseWebConfigInput({ signatoryTitle: 'x'.repeat(TEXT_MAX + 1) });
  const number = parseWebConfigInput({ signatoryName: 42 });

  // Assert
  assert.equal(atLimit.values.signatoryTitle.length, TEXT_MAX);
  assert.match(overLimit.error, /maksimal/);
  assert.match(number.error, /teks/);
});

test('rows map to keys by description, url keys from url_image and text keys from value_text', () => {
  // Arrange
  const rows = [
    { description: 'logo', url_image: 'https://a.example/logo.png', value_text: null },
    { description: 'Tanda Tangan', url_image: ' ', value_text: null },
    { description: 'Nama Penandatangan', url_image: 'https://ignored.example', value_text: 'Nama Uji' },
    { description: 'Fav Icon', url_image: 'https://legacy.example/fav.png', value_text: null },
    { description: 'Favicon', url_image: 'http://legacy.example/fav.png', value_text: null },
  ];

  // Act
  const config = rowsToConfig(rows);

  // Assert
  assert.deepEqual(config, {
    logo: 'https://a.example/logo.png',
    favicon: null,
    signature: null,
    signatoryName: 'Nama Uji',
    signatoryTitle: null,
  });
});

test('the public view holds only logo and favicon, never the signatory', () => {
  // Arrange
  const config = {
    logo: 'https://a.example/logo.png', favicon: null,
    signature: 'https://a.example/ttd.png', signatoryName: 'Nama Uji', signatoryTitle: 'Jabatan Uji',
  };

  // Act
  const view = publicConfig(config);

  // Assert
  assert.deepEqual(view, { logo: 'https://a.example/logo.png', favicon: null });
});

test('the public endpoint is whitelisted and the full config is not', async () => {
  // Arrange
  const call = (path) => new Promise((resolve) => {
    const req = { method: 'GET', baseUrl: '/api', path, session: {} };
    const res = { status: (code) => ({ json: () => resolve(code) }) };
    apiGate(req, res, () => resolve('next'));
  });

  // Act
  const publicResult = await call('/web-config/public');
  const fullResult = await call('/web-config');

  // Assert
  assert.ok(PUBLIC_API.has('GET /api/web-config/public'));
  assert.equal(publicResult, 'next');
  assert.equal(fullResult, 401);
});

test('signatory comes from settings first and falls back per field to brand.cjs', () => {
  // Act
  const fromSettings = signatoryFrom({ signatoryName: 'Nama Uji', signatoryTitle: null }, { name: 'Bawaan', title: 'Jabatan Bawaan' });
  const empty = signatoryFrom({ signatoryName: null, signatoryTitle: null }, SIGNATORY);

  // Assert
  assert.deepEqual(fromSettings, { name: 'Nama Uji', title: 'Jabatan Bawaan' });
  assert.deepEqual(empty, { name: null, title: null });
});

test('receipt html and text print the signatory taken from settings', () => {
  // Arrange
  const signatory = signatoryFrom({ signatoryName: 'Nama <Uji>', signatoryTitle: 'Jabatan Uji' }, SIGNATORY);
  const data = {
    bookingCode: 'QA-WEBCONFIG', customerName: 'Pelanggan Uji', carType: 'Mobil Uji',
    startDate: '2026-11-23', startTime: '09:00:00', endDate: '2026-11-26',
    needs: { trip: false, driver: false, delivery: false, pickup: false },
    totals: computeTotals({ rental_cost: 1000000, deposit: 0, discount: 0 }),
    logoUrl: null, signatureUrl: null, signatory,
  };

  // Act
  const html = generateReceiptEmail(data);
  const text = generateReceiptText(data);

  // Assert
  assert.ok(html.includes('Nama &lt;Uji&gt;') && html.includes('Jabatan Uji'));
  assert.ok(!html.includes('Nama <Uji>'));
  assert.ok(text.includes(['Nama <Uji>', 'Jabatan Uji', 'Andi Rental Mobil'].join('\n')));
});
