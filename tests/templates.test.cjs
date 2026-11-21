const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateInvoiceEmail } = require('../project/src/components/emailTemplates/invoiceTemplate.cjs');
const { generateReceiptEmail, generateReceiptText } = require('../project/src/components/emailTemplates/receiptTemplate.cjs');
const { computeTotals } = require('../project/src/lib/pricing.mjs');

const PAYLOAD = '<b>QA</b><img src=x onerror=alert(1)>';

function sample(overrides = {}, rowOverrides = {}) {
  const row = {
    rental_cost: 1000000, deposit: 400000, discount: 100000,
    needs_driver: true, driver_fee: 200000,
    needs_delivery: false, delivery_fee: 150000,
    needs_trip: false, needs_pickup: false,
    ...rowOverrides,
  };
  return {
    bookingCode: 'QA-K-TEST',
    customerName: PAYLOAD,
    carType: 'Mobil Uji',
    startDate: '2026-11-23',
    startTime: '09:00:00',
    endDate: '2026-11-26',
    needs: { trip: false, driver: true, delivery: false, pickup: false },
    totals: computeTotals(row),
    bankList: [{ bankName: 'Bank <x>', logoUrl: 'javascript:alert(1)', accountNumber: '123', accountHolder: 'A' }],
    logoUrl: null,
    ...overrides,
  };
}

function amounts(html) {
  return [...html.matchAll(/Rp\s?([\d.]+)/g)].map((m) => Number(m[1].replace(/\./g, '')));
}

test('invoice escapes the customer name and hides inactive services', () => {
  // Arrange
  const data = sample();

  // Act
  const html = generateInvoiceEmail(data);

  // Assert
  assert.ok(html.includes('&lt;b&gt;QA&lt;/b&gt;'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('Biaya Antar'));
  assert.ok(html.includes('Biaya Sopir'));
  assert.ok(!html.includes('javascript:'));
});

test('invoice shows grand_total as the largest amount', () => {
  // Arrange
  const data = sample();

  // Act
  const html = generateInvoiceEmail(data);

  // Assert
  assert.ok(html.includes('Rp1.500.000'));
  assert.ok(html.includes('Subtotal sewa dan layanan'));
  assert.ok(html.includes('Rp1.100.000'));
  assert.equal(Math.max(...amounts(html)), 1500000);
  assert.ok(html.includes('Dikembalikan setelah masa sewa selesai'));
  assert.ok(html.includes('0812-1959-7989'));
});

test('invoice without logo renders no img with an empty src', () => {
  // Arrange
  const data = sample({ bankList: [] });

  // Act
  const html = generateInvoiceEmail(data);

  // Assert
  assert.ok(!/<img[^>]*src=""/.test(html));
  assert.ok(!html.includes('<img'));
});

test('receipt without signature or logo has no img tag and keeps the paid total', () => {
  // Arrange
  const data = sample({ signatureUrl: null, issuedAt: new Date('2026-11-20T07:05:00Z') });

  // Act
  const html = generateReceiptEmail(data);

  // Assert
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('LUNAS'));
  assert.ok(html.includes('&lt;b&gt;'));
  assert.equal(Math.max(...amounts(html)), 1500000);
  assert.ok(html.includes('20 November 2026, 14.05 WIB'));
});

test('receipt renders the signature only for an http(s) URL', () => {
  // Arrange
  const withSig = sample({ signatureUrl: 'https://example.com/ttd.png' });
  const badSig = sample({ signatureUrl: 'javascript:alert(1)' });

  // Act
  const good = generateReceiptEmail(withSig);
  const bad = generateReceiptEmail(badSig);

  // Assert
  assert.ok(good.includes('src="https://example.com/ttd.png"'));
  assert.ok(!bad.includes('<img'));
});

test('receipt without signatory or deposit note keeps the approved deposit sentence and no empty lines', () => {
  // Arrange
  const data = sample({ signatory: { name: null, title: null }, depositReturnNote: null });

  // Act
  const html = generateReceiptEmail(data);

  // Assert
  assert.ok(html.includes('akan dikembalikan setelah masa sewa selesai'));
  assert.match(html, /Hormat kami,<\/p>\s*<p style="margin:8px 0 0 0; font-weight:700;">Andi Rental Mobil<\/p>/);
  assert.ok(!/<p[^>]*>\s*<\/p>/.test(html));
  assert.ok(!html.includes('null'));
});

test('receipt shows signatory and deposit note only when brand values are filled', () => {
  // Arrange
  const data = sample({ signatory: { name: 'Nama Uji', title: 'Jabatan Uji' }, depositReturnNote: 'Catatan uji.' });

  // Act
  const html = generateReceiptEmail(data);
  const text = generateReceiptText(data);

  // Assert
  assert.ok(html.includes('Nama Uji') && html.includes('Jabatan Uji') && html.includes('Catatan uji.'));
  assert.ok(text.includes(['Nama Uji', 'Jabatan Uji', 'Andi Rental Mobil'].join('\n')));
});

test('receipt subtotal row comes from totals.subtotal and the total is the largest amount', () => {
  // Arrange
  const data = sample();

  // Act
  const html = generateReceiptEmail(data);

  // Assert
  assert.ok(html.includes('Subtotal sewa dan layanan'));
  assert.ok(html.includes('Rp1.100.000'));
  assert.ok(html.includes('-Rp100.000'));
  assert.ok(html.includes('Sopir'));
  assert.ok(!html.includes('Antar mobil'));
  assert.equal(Math.max(...amounts(html)), 1500000);
});

test('receipt with deposit 0, no discount, no services and no start time drops those rows', () => {
  // Arrange
  const data = sample(
    { needs: { trip: false, driver: false, delivery: false, pickup: false }, startTime: null },
    { deposit: 0, discount: 0, needs_driver: false },
  );

  // Act
  const html = generateReceiptEmail(data);
  const text = generateReceiptText(data);

  // Assert
  for (const hidden of ['Subtotal', 'Deposit', 'Diskon', 'Sopir', 'pukul']) {
    assert.ok(!html.includes(hidden), hidden);
    assert.ok(!text.includes(hidden), hidden);
  }
  assert.ok(html.includes('Rp1.000.000'));
});

test('receipt ignores a non-https logo and falls back to the brand name as text', () => {
  // Arrange
  const httpLogo = sample({ logoUrl: 'http://localhost:5000/api/files/logo.png' });
  const httpsLogo = sample({ logoUrl: 'https://example.com/logo.png' });

  // Act
  const fallback = generateReceiptEmail(httpLogo);
  const withLogo = generateReceiptEmail(httpsLogo);

  // Assert
  assert.ok(!fallback.includes('<img'));
  assert.ok(withLogo.includes('<img src="https://example.com/logo.png"'));
});

test('receipt plain text keeps the name as typed and carries the paid total', () => {
  // Arrange
  const data = sample({ issuedAt: new Date('2026-11-20T07:05:00Z') });

  // Act
  const text = generateReceiptText(data);

  // Assert
  assert.ok(text.includes('Total dibayar: Rp1.500.000'));
  assert.ok(text.includes('Deposit (uang jaminan, dikembalikan setelah sewa selesai): Rp400.000'));
  assert.ok(text.includes(`Halo ${PAYLOAD},`));
});

test('N5: invoice drops non-https logo and bank logos, keeps https ones', () => {
  // Arrange
  const httpOnly = sample({
    logoUrl: 'http://localhost:5000/api/files/logo.png',
    bankList: [{ bankName: 'Bank QA', logoUrl: 'http://example.com/bank.png', accountNumber: '123', accountHolder: 'A' }],
  });
  const httpsOnly = sample({
    logoUrl: 'https://example.com/logo.png',
    bankList: [{ bankName: 'Bank QA', logoUrl: 'https://example.com/bank.png', accountNumber: '123', accountHolder: 'A' }],
  });

  // Act
  const fallback = generateInvoiceEmail(httpOnly);
  const withLogos = generateInvoiceEmail(httpsOnly);

  // Assert
  assert.ok(!fallback.includes('<img'));
  assert.ok(fallback.includes('Bank QA'));
  assert.ok(withLogos.includes('<img src="https://example.com/logo.png"'));
  assert.ok(withLogos.includes('<img src="https://example.com/bank.png"'));
});
