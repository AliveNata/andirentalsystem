const { escapeHtml, safeUrl, safeImageUrl, formatRupiah, formatDateId, formatTimeId } = require('./htmlSafe.cjs');
const { ADMIN_WHATSAPP, BRAND_NAME } = require('./brand.cjs');

const SERVICES = [
  ['driver', 'driver_fee', 'Biaya Sopir'],
  ['delivery', 'delivery_fee', 'Biaya Antar Mobil'],
  ['pickup', 'pickup_fee', 'Biaya Jemput Mobil'],
  ['trip', 'trip_fee', 'Biaya Luar Kota'],
];

function amountRow(label, value, { note = '', strong = false, topBorder = false } = {}) {
  const border = topBorder ? 'border-top:1px solid #ccc;' : '';
  const weight = strong ? 'font-weight:bold;' : '';
  const noteHtml = note ? `<br><span style="font-size:12px;color:#57534E;">${escapeHtml(note)}</span>` : '';
  return `
          <tr style="${weight}">
            <td style="padding:6px 0;${border}">${escapeHtml(label)}${noteHtml}</td>
            <td align="right" style="padding:6px 0;white-space:nowrap;vertical-align:top;${border}">${escapeHtml(value)}</td>
          </tr>`;
}

// Totals come from computeTotals() on the stored row; this template only prints them.
function generateInvoiceEmail({
  bookingCode,
  customerName,
  carType,
  startDate,
  startTime,
  endDate,
  needs,
  totals,
  bankList = [],
  logoUrl,
  adminWhatsapp = ADMIN_WHATSAPP,
}) {
  const logo = safeImageUrl(logoUrl);
  const waLink = safeUrl(adminWhatsapp.waLink);
  const waText = escapeHtml(adminWhatsapp.display);
  const waHtml = waLink
    ? `<a href="${waLink}" style="color:#C2410C;text-decoration:underline;">${waText}</a>`
    : waText;
  const startTimeText = formatTimeId(startTime);

  const header = logo
    ? `<img src="${logo}" alt="${escapeHtml(BRAND_NAME)}" width="120" style="display:block;margin:0 auto 8px;" />`
    : `<p style="margin:0;color:#fff;font-size:20px;font-weight:bold;">${escapeHtml(BRAND_NAME)}</p>`;

  const bankRows = bankList.map((bank) => {
    const bankLogo = safeImageUrl(bank.logoUrl);
    return `
            <tr style="vertical-align:middle;text-align:center;">
              <td style="padding:8px;">
                ${bankLogo ? `<img src="${bankLogo}" alt="${escapeHtml(bank.bankName)}" style="height:32px;" />` : escapeHtml(bank.bankName)}
              </td>
              <td style="padding:8px;font-size:14px;"><strong>${escapeHtml(bank.accountNumber)}</strong></td>
              <td style="padding:8px;font-size:14px;">a/n ${escapeHtml(bank.accountHolder)}</td>
            </tr>`;
  }).join('');

  const serviceRows = SERVICES
    .filter(([flag]) => needs[flag] === true)
    .map(([, key, label]) => amountRow(label, formatRupiah(totals[key])))
    .join('');

  const yesNo = (flag) => (needs[flag] === true ? 'Ya' : 'Tidak');

  return `
  <div style="background-color:#f1f1f1;padding:24px;font-family:Arial,sans-serif">
    <div style="max-width:640px;margin:auto;border:2px solid #C2410C;border-radius:10px;overflow:hidden;background-color:#fff;">

      <div style="background-color:#C2410C;padding:24px;text-align:center;">
        ${header}
        <p style="margin:12px 0 0;color:#fff;font-size:14px;">Konfirmasi Pemesanan Mobil Anda</p>
      </div>

      <div style="background-color:#f1f1f1;padding:24px;text-align:left;font-size:14px;color:#333;">
        <p style="margin:0 0 12px;">
          Halo <strong>${escapeHtml(customerName)}</strong>,<br><br>
          Terima kasih sudah memesan mobil di <strong>${escapeHtml(BRAND_NAME)}</strong>.<br><br>
          Kode booking Anda sudah dibuat. Silakan lakukan pembayaran dalam <strong>1x24 jam</strong> sejak email ini dikirim. Jika lewat dari batas waktu tersebut dan belum ada konfirmasi, kode booking akan dibatalkan.<br><br>
          Untuk informasi lebih lanjut atau konfirmasi pembayaran, hubungi admin kami lewat WhatsApp di ${waHtml}.
        </p>
      </div>

      <div style="border-top: 2px dotted #ccc; width: 100%; margin: 0;"></div>

      <div style="background-color:#ffffff;padding:24px;text-align:center;">
        <p style="margin:0;font-weight:bold;font-size:16px;">Silakan lakukan pembayaran ke salah satu rekening berikut</p>
        <table align="center" cellpadding="0" cellspacing="0" style="margin-top:16px;">
          ${bankRows}
        </table>
      </div>

      <div style="padding:0 24px;">
        <div style="border-top:1px dashed #ccc;margin:24px 0;"></div>
        <table cellpadding="0" cellspacing="0" width="100%" style="font-size:14px;color:#333;text-align:center;">
          <tr>
            <td style="padding:12px;border:1px solid #ccc;"><strong>Kode Booking</strong><br>${escapeHtml(bookingCode)}</td>
            <td style="padding:12px;border:1px solid #ccc;"><strong>Mobil yang Dipesan</strong><br>${escapeHtml(carType)}</td>
          </tr>
          <tr>
            <td style="padding:12px;border:1px solid #ccc;">
              <strong>Tanggal Sewa Dimulai</strong><br>
              ${escapeHtml(formatDateId(startDate))}${startTimeText ? `, pukul ${escapeHtml(startTimeText)}` : ''}
            </td>
            <td style="padding:12px;border:1px solid #ccc;"><strong>Tanggal Sewa Berakhir</strong><br>${escapeHtml(formatDateId(endDate))}</td>
          </tr>
          <tr>
            <td style="padding:12px;border:1px solid #ccc;"><strong>Luar Kota</strong><br>${yesNo('trip')}</td>
            <td style="padding:12px;border:1px solid #ccc;"><strong>Pakai Jasa Sopir</strong><br>${yesNo('driver')}</td>
          </tr>
          <tr>
            <td style="padding:12px;border:1px solid #ccc;"><strong>Antar Mobil</strong><br>${yesNo('delivery')}</td>
            <td style="padding:12px;border:1px solid #ccc;"><strong>Jemput Mobil</strong><br>${yesNo('pickup')}</td>
          </tr>
        </table>
      </div>

      <div style="padding:24px;">
        <h3 style="margin-top:0;margin-bottom:12px;color:#C2410C;">Rincian Pembayaran</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#333;">
          ${amountRow('Biaya Sewa', formatRupiah(totals.rental_cost))}
          ${totals.discount_applied > 0 ? amountRow('Diskon', '-' + formatRupiah(totals.discount_applied)) : ''}
          ${serviceRows}
          ${totals.deposit > 0 ? amountRow('Subtotal sewa dan layanan', formatRupiah(totals.subtotal), { topBorder: true }) : ''}
          ${totals.deposit > 0 ? amountRow('Deposit (uang jaminan)', formatRupiah(totals.deposit), { note: 'Dikembalikan setelah masa sewa selesai' }) : ''}
          ${amountRow('Total yang harus dibayar', formatRupiah(totals.grand_total), { strong: true, topBorder: true })}
        </table>
      </div>

      <div style="border-top: 2px dotted #ccc; width: 100%; margin: 0;"></div>

      <div style="background-color:#f1f1f1;padding:12px;text-align:center;font-size:12px;color:#57534E;">
        Email ini dikirim otomatis, jadi mohon jangan dibalas. Untuk pertanyaan, hubungi WhatsApp admin dan sebutkan kode booking Anda.
      </div>

    </div>
  </div>
  `;
}

module.exports = { generateInvoiceEmail };
