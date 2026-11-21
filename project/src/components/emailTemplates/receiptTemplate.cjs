const {
  escapeHtml, safeImageUrl, safeUrl, formatRupiah, formatDateId, formatTimeId, formatDateTimeId,
} = require('./htmlSafe.cjs');
const {
  ADMIN_WHATSAPP, BRAND_NAME, COMPANY_NAME, COMPANY_EMAIL, COMPANY_ADDRESS, SIGNATORY, DEPOSIT_RETURN_NOTE,
} = require('./brand.cjs');

// Layout and copy: plans/2026-11-20-receipt-design.md. Every amount comes from computeTotals();
// this file only decides which rows to show.

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "Consolas, 'Courier New', monospace";
const C = {
  brand: '#C2410C',
  ink: '#1C1917',
  muted: '#57534E',
  paid: '#166534',
  paidBg: '#F0FDF4',
  paidLine: '#BBF7D0',
  depositBg: '#FFF7ED',
  page: '#F5F5F4',
  line: '#E7E5E4',
  card: '#FFFFFF',
};

const SERVICES = [
  ['driver', 'driver_fee', 'Sopir'],
  ['delivery', 'delivery_fee', 'Antar mobil'],
  ['pickup', 'pickup_fee', 'Jemput mobil'],
  ['trip', 'trip_fee', 'Perjalanan luar kota'],
];

function hasText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function startText(startDate, startTime) {
  const time = formatTimeId(startTime);
  return formatDateId(startDate) + (time ? `, pukul ${time}` : '');
}

// Rows shared by the HTML and plain-text versions so both follow the same show/hide rules.
function costRows(needs, totals) {
  const rows = [{ label: 'Biaya sewa', value: formatRupiah(totals.rental_cost) }];
  if (totals.discount_applied > 0) {
    rows.push({ label: 'Diskon', value: '-' + formatRupiah(totals.discount_applied) });
  }
  for (const [flag, key, label] of SERVICES) {
    if (needs[flag] === true) rows.push({ label, value: formatRupiah(totals[key]) });
  }
  if (totals.deposit > 0) {
    rows.push({ label: 'Subtotal sewa dan layanan', value: formatRupiah(totals.subtotal), kind: 'subtotal' });
    rows.push({
      label: 'Deposit (uang jaminan)',
      note: 'Dikembalikan setelah sewa selesai',
      textLabel: 'Deposit (uang jaminan, dikembalikan setelah sewa selesai)',
      value: formatRupiah(totals.deposit),
    });
  }
  rows.push({ label: 'Total dibayar', value: formatRupiah(totals.grand_total), kind: 'total' });
  return rows;
}

function detailRowHtml(label, value, { mono = false, last = false } = {}) {
  const border = last ? '' : ` border-bottom:1px solid ${C.line};`;
  const valueStyle = mono
    ? `font-family:${MONO}; font-size:16px; line-height:22px; font-weight:700; word-break:break-all;`
    : 'font-size:15px; line-height:22px; word-break:break-word;';
  return `
              <tr>
                <td style="padding:10px 0;${border}">
                  <p style="margin:0; font-size:13px; line-height:18px; color:${C.muted};">${escapeHtml(label)}</p>
                  <p style="margin:2px 0 0 0; ${valueStyle} color:${C.ink};">${escapeHtml(value)}</p>
                </td>
              </tr>`;
}

function costRowHtml({ label, value, note, kind }) {
  let cell = 'padding:8px 12px 8px 0; vertical-align:top;';
  let amount = 'padding:8px 0; white-space:nowrap; text-align:right; vertical-align:top;';
  if (kind === 'subtotal') {
    cell = `padding:10px 12px 8px 0; border-top:1px solid ${C.line}; color:${C.muted};`;
    amount = `padding:10px 0 8px 0; border-top:1px solid ${C.line}; white-space:nowrap; text-align:right; color:${C.muted};`;
  } else if (kind === 'total') {
    const strong = `border-top:2px solid ${C.ink}; font-size:17px; line-height:24px; font-weight:700;`;
    cell = `padding:12px 12px 0 0; ${strong}`;
    amount = `padding:12px 0 0 0; ${strong} white-space:nowrap; text-align:right;`;
  }
  const noteHtml = note
    ? `\n                  <span style="display:block; font-size:13px; line-height:18px; color:${C.muted};">${escapeHtml(note)}</span>`
    : '';
  return `
              <tr>
                <td style="${cell}">${escapeHtml(label)}${noteHtml}</td>
                <td align="right" style="${amount}">${escapeHtml(value)}</td>
              </tr>`;
}

function link(href, text, extra = '') {
  return href
    ? `<a href="${href}" style="color:${C.brand}; text-decoration:underline;${extra}">${escapeHtml(text)}</a>`
    : escapeHtml(text);
}

function generateReceiptEmail({
  bookingCode,
  customerName,
  carType,
  startDate,
  startTime,
  endDate,
  needs,
  totals,
  issuedAt = new Date(),
  logoUrl,
  signatureUrl,
  adminWhatsapp = ADMIN_WHATSAPP,
  signatory = SIGNATORY,
  depositReturnNote = DEPOSIT_RETURN_NOTE,
}) {
  const logo = safeImageUrl(logoUrl);
  const signature = safeImageUrl(signatureUrl);
  const waLink = safeUrl(adminWhatsapp.waLink);
  const mailLink = `mailto:${escapeHtml(COMPANY_EMAIL)}`;
  const total = formatRupiah(totals.grand_total);
  const showDeposit = totals.deposit > 0;

  // The logo sits on its own brand-colored band because its colors are not known to read on white (user, T2).
  const header = logo
    ? `<img src="${logo}" width="140" alt="${escapeHtml(BRAND_NAME)}" style="display:block; width:140px; max-width:140px; height:auto; border:0; outline:none; text-decoration:none; font-family:${FONT}; font-size:20px; line-height:26px; font-weight:700; color:#FFFFFF;">`
    : `<p style="margin:0; font-family:${FONT}; font-size:20px; line-height:26px; font-weight:700; color:#FFFFFF;">${escapeHtml(BRAND_NAME)}</p>`;

  const depositBlock = showDeposit ? `
        <tr>
          <td class="card-pad" style="padding:24px 24px 0 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.depositBg}; border-radius:6px;">
              <tr>
                <td style="padding:16px; font-family:${FONT}; font-size:14px; line-height:20px; color:${C.ink};">
                  Deposit <strong>${escapeHtml(formatRupiah(totals.deposit))}</strong> adalah uang jaminan dan akan dikembalikan setelah masa sewa selesai. Kalau ada pertanyaan soal pengembalian deposit, hubungi admin lewat WhatsApp ${link(waLink, adminWhatsapp.display)}.${hasText(depositReturnNote) ? `
                  <p style="margin:8px 0 0 0;">${escapeHtml(depositReturnNote)}</p>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>` : '';

  const signatureHtml = signature ? `
            <img src="${signature}" width="160" alt="Tanda tangan ${escapeHtml(BRAND_NAME)}" style="display:block; width:160px; max-width:160px; height:auto; border:0; margin:8px 0 0 0; font-size:13px; line-height:18px; color:${C.muted};">` : '';
  const signatoryHtml = [
    hasText(signatory?.name) ? `
            <p style="margin:8px 0 0 0; font-weight:700;">${escapeHtml(signatory.name)}</p>` : '',
    hasText(signatory?.title) ? `
            <p style="margin:2px 0 0 0; font-size:13px; line-height:18px; color:${C.muted};">${escapeHtml(signatory.title)}</p>` : '',
  ].join('');
  const brandLine = hasText(signatory?.name)
    ? `
            <p style="margin:2px 0 0 0;">${escapeHtml(BRAND_NAME)}</p>`
    : `
            <p style="margin:8px 0 0 0; font-weight:700;">${escapeHtml(BRAND_NAME)}</p>`;

  return `<!DOCTYPE html>
<html lang="id" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Bukti pembayaran lunas untuk booking ${escapeHtml(bookingCode)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>table, td, h1, h2, p, a, span { font-family: Arial, sans-serif !important; }</style>
<![endif]-->
<style>
  @media only screen and (max-width: 480px) {
    .outer-pad { padding-left: 8px !important; padding-right: 8px !important; }
    .card-pad { padding-left: 16px !important; padding-right: 16px !important; }
    .total-amount { font-size: 24px !important; line-height: 30px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:${C.page}; -webkit-text-size-adjust:100%;">
<div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">${escapeHtml(receiptPreheader({ carType, totals }))}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.page};">
  <tr>
    <td class="outer-pad" align="center" style="padding:24px 12px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background-color:${C.card}; border-radius:6px;">

        <tr>
          <td class="card-pad" style="padding:20px 24px; background-color:${C.brand}; border-radius:6px 6px 0 0;">
            ${header}
          </td>
        </tr>

        <tr>
          <td class="card-pad" style="padding:24px 24px 0 24px; font-family:${FONT};">
            <h1 style="margin:0; font-size:22px; line-height:28px; font-weight:700; color:${C.ink};">Bukti Pembayaran</h1>
            <p style="margin:8px 0 0 0; font-size:15px; line-height:22px; color:${C.ink}; word-break:break-word;">Halo ${escapeHtml(customerName)}, pembayaran untuk booking ${escapeHtml(bookingCode)} sudah kami terima penuh. Simpan email ini sebagai bukti pembayaran.</p>
          </td>
        </tr>

        <tr>
          <td class="card-pad" style="padding:24px 24px 0 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.paidBg}; border:1px solid ${C.paidLine}; border-radius:6px;">
              <tr>
                <td style="padding:20px; font-family:${FONT};">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="border:2px solid ${C.paid}; border-radius:4px; padding:4px 12px; font-size:14px; line-height:20px; font-weight:700; letter-spacing:2px; color:${C.paid};">LUNAS</td>
                    </tr>
                  </table>
                  <p style="margin:12px 0 0 0; font-size:14px; line-height:20px; color:${C.muted};">Total dibayar</p>
                  <p class="total-amount" style="margin:2px 0 0 0; font-size:28px; line-height:34px; font-weight:700; color:${C.ink}; white-space:nowrap;">${escapeHtml(total)}</p>
                  <p style="margin:8px 0 0 0; font-size:13px; line-height:18px; color:${C.muted};">Diterbitkan ${escapeHtml(formatDateTimeId(issuedAt))}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="card-pad" style="padding:28px 24px 0 24px; font-family:${FONT};">
            <h2 style="margin:0 0 4px 0; font-size:16px; line-height:22px; font-weight:700; color:${C.ink};">Detail sewa</h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detailRowHtml('Kode booking', bookingCode, { mono: true })}${detailRowHtml('Nama penyewa', customerName)}${detailRowHtml('Mobil', carType)}${detailRowHtml('Mulai sewa', startText(startDate, startTime))}${detailRowHtml('Selesai sewa', formatDateId(endDate), { last: true })}
            </table>
          </td>
        </tr>

        <tr>
          <td class="card-pad" style="padding:28px 24px 0 24px; font-family:${FONT};">
            <h2 style="margin:0 0 4px 0; font-size:16px; line-height:22px; font-weight:700; color:${C.ink};">Rincian biaya</h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px; line-height:22px; color:${C.ink};">${costRows(needs, totals).map(costRowHtml).join('')}
            </table>
          </td>
        </tr>
${depositBlock}
        <tr>
          <td class="card-pad" style="padding:28px 24px 28px 24px; font-family:${FONT}; font-size:15px; line-height:22px; color:${C.ink};">
            <p style="margin:0;">Terima kasih sudah menyewa mobil di ${escapeHtml(BRAND_NAME)}.</p>
            <p style="margin:16px 0 0 0;">Hormat kami,</p>${signatureHtml}${signatoryHtml}${brandLine}
          </td>
        </tr>

      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr>
          <td class="card-pad" style="padding:20px 24px 8px 24px; font-family:${FONT}; font-size:13px; line-height:20px; color:${C.muted};">
            <p style="margin:0; font-weight:700;">${escapeHtml(COMPANY_NAME)} (${escapeHtml(BRAND_NAME)})</p>
            <p style="margin:4px 0 0 0;">${escapeHtml(COMPANY_ADDRESS)}</p>
            <p style="margin:0; padding:12px 0 0 0;">WhatsApp admin: ${link(waLink, adminWhatsapp.display, ' display:inline-block; padding:0 0 12px 0;')}</p>
            <p style="margin:0;">Email: ${link(mailLink, COMPANY_EMAIL, ' display:inline-block; padding:0 0 12px 0;')}</p>
            <p style="margin:0;">Email ini dikirim otomatis, jadi mohon jangan dibalas. Untuk pertanyaan, hubungi WhatsApp admin dan sebutkan kode booking Anda.</p>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

function receiptPreheader({ carType, totals }) {
  return `Pembayaran sewa ${carType || ''} sudah lunas. Total ${formatRupiah(totals.grand_total)}.`;
}

// Plain-text part for clients that block HTML; same rows and show/hide rules as the HTML.
function generateReceiptText({
  bookingCode,
  customerName,
  carType,
  startDate,
  startTime,
  endDate,
  needs,
  totals,
  issuedAt = new Date(),
  adminWhatsapp = ADMIN_WHATSAPP,
  signatory = SIGNATORY,
  depositReturnNote = DEPOSIT_RETURN_NOTE,
}) {
  const costLines = costRows(needs, totals).map(({ label, textLabel, value }) => `${textLabel || label}: ${value}`);
  const lines = [
    'Bukti Pembayaran',
    BRAND_NAME,
    '',
    `Halo ${customerName}, pembayaran untuk booking ${bookingCode} sudah kami terima penuh. Simpan email ini sebagai bukti pembayaran.`,
    '',
    'LUNAS',
    `Total dibayar: ${formatRupiah(totals.grand_total)}`,
    `Diterbitkan ${formatDateTimeId(issuedAt)}`,
    '',
    'Detail sewa',
    `Kode booking: ${bookingCode}`,
    `Nama penyewa: ${customerName}`,
    `Mobil: ${carType}`,
    `Mulai sewa: ${startText(startDate, startTime)}`,
    `Selesai sewa: ${formatDateId(endDate)}`,
    '',
    'Rincian biaya',
    ...costLines,
  ];
  if (totals.deposit > 0) {
    lines.push('', `Deposit ${formatRupiah(totals.deposit)} adalah uang jaminan dan akan dikembalikan setelah masa sewa selesai. Kalau ada pertanyaan soal pengembalian deposit, hubungi admin lewat WhatsApp ${adminWhatsapp.display}.`);
    if (hasText(depositReturnNote)) lines.push(depositReturnNote);
  }
  lines.push('', `Terima kasih sudah menyewa mobil di ${BRAND_NAME}.`, '', 'Hormat kami,');
  if (hasText(signatory?.name)) lines.push(signatory.name);
  if (hasText(signatory?.title)) lines.push(signatory.title);
  lines.push(
    BRAND_NAME,
    '',
    `${COMPANY_NAME} (${BRAND_NAME})`,
    COMPANY_ADDRESS,
    `WhatsApp admin: ${adminWhatsapp.display} (${adminWhatsapp.waLink})`,
    `Email: ${COMPANY_EMAIL}`,
    'Email ini dikirim otomatis, jadi mohon jangan dibalas. Untuk pertanyaan, hubungi WhatsApp admin dan sebutkan kode booking Anda.',
  );
  return lines.join('\n');
}

module.exports = { generateReceiptEmail, generateReceiptText, receiptPreheader };
