function generateInvoiceEmail({
  customerName,
  bookingCode,
  carType,
  startDate,
  startTime,
  endDate,
  needsTrip,
  needsDriver,
  needsDelivery,
  needsPickup,
  rentalCost,
  deposit,
  discount,
  tripFee,
  driverFee,
  deliveryFee,
  pickupFee,
  bankList,
  logoUrl
}) {
  const dps = Number(deposit) || 0;
  const tf = Number(tripFee) || 0;
  const df = Number(driverFee) || 0;
  const dlf = Number(deliveryFee) || 0;
  const puf = Number(pickupFee) || 0;
  const disc = Number(discount) || 0;
  const baseRental = Number(rentalCost) || 0;

  const discountedRentalCost = baseRental - disc;
  const grandTotalBeforeDeposit = baseRental - dps;
  const grandTotalBeforeDiscount = baseRental + dps + tf + df + dlf + puf;
  const grandTotalAfterDiscount = discountedRentalCost + dps + tf + df + dlf + puf;

  return `
  <div style="background-color:#f1f1f1;padding:24px;font-family:Arial,sans-serif">
    <div style="max-width:640px;margin:auto;border:2px solid #f97316;border-radius:10px;overflow:hidden;background-color:#fff;">

      <!-- HEADER -->
      <div style="background-color:#f97316;padding:24px;text-align:center;">
        <img src="${logoUrl}" alt="Andi Rental Mobil" width="120" style="display:block; margin:0 auto 8px;" />
        <p style="margin:12px 0 0;color:#fff;font-size:14px;">Konfirmasi Pemesanan Mobil Anda</p>
      </div>

      <!-- INFO CUSTOMER -->
      <div style="background-color:#f1f1f1;padding:24px;text-align:left;font-size:14px;color:#333;">
        <p style="margin:0 0 12px;">
          Hai <strong>${customerName}</strong>,<br><br>
          Terima kasih sudah melakukan pemesanan di <strong>Andi Rental Mobil</strong>.<br><br>
          Kode booking kamu sudah berhasil dibuat. Silakan lakukan pembayaran dalam waktu <strong>1x24 jam</strong> sejak email ini dikirim. Jika melebihi batas waktu tersebut dan belum ada konfirmasi, maka kode booking akan otomatis dibatalkan oleh sistem.<br><br>
          Kalau kamu butuh info lebih lanjut atau ingin konfirmasi pembayaran, silakan hubungi tim admin kami lewat WhatsApp di:
          <a href="https://wa.me/628123456789" style="color:#f97316;text-decoration:underline;">08123456789</a> /
          <a href="https://wa.me/628777777777" style="color:#f97316;text-decoration:underline;">0877777777</a>
        </p>
      </div>

      <!-- DOT LINE ATAS -->
      <div style="border-top: 2px dotted #ccc; width: 100%; margin: 0;"></div>

      <!-- REKENING -->
      <div style="background-color:#ffffff;padding:24px;text-align:center;">
        <p style="margin:0;font-weight:bold;font-size:16px;">💳 Silakan melakukan pembayaran ke nomor rekening di bawah ini</p>
        <table align="center" cellpadding="0" cellspacing="0" style="margin-top:16px;">
          ${bankList.map(bank => `
            <tr style="vertical-align:middle;text-align:center;">
              <td style="padding:8px;">
                ${bank.logoUrl ? `<img src="${bank.logoUrl}" alt="${bank.bankName}" style="height:32px;" />` : ''}
              </td>
              <td style="padding:8px;font-size:14px;"><strong>${bank.accountNumber}</strong></td>
              <td style="padding:8px;font-size:14px;">a/n ${bank.accountHolder}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      <!-- INFO BOOKING -->
      <div style="padding:0 24px;">
        <div style="border-top:1px dashed #ccc;margin:24px 0;"></div>
        <table cellpadding="0" cellspacing="0" width="100%" style="font-size:14px;color:#333;text-align:center;">
          <tr>
            <td style="padding:12px;border:1px solid #ccc;"><strong>Kode Booking</strong><br>${bookingCode}</td>
            <td style="padding:12px;border:1px solid #ccc;"><strong>Mobil yang Dipesan</strong><br>${carType}</td>
          </tr>
          <tr>
            <td style="padding:12px;border:1px solid #ccc;">
              <strong>Tanggal Sewa Dimulai</strong><br>
              ${startDate}${startTime ? ` ${startTime}` : ''}
            </td>
            <td style="padding:12px;border:1px solid #ccc;"><strong>Tanggal Sewa Berakhir</strong><br>${endDate}</td>
          </tr>
          <tr>
            <td style="padding:12px;border:1px solid #ccc;"><strong>Luar Kota</strong><br>${needsTrip ? 'Iya' : 'Tidak'}</td>
            <td style="padding:12px;border:1px solid #ccc;"><strong>Pakai Jasa Supir</strong><br>${needsDriver ? 'Iya' : 'Tidak'}</td>
          </tr>
          <tr>
            <td style="padding:12px;border:1px solid #ccc;"><strong>Antar Mobil</strong><br>${needsDelivery ? 'Iya' : 'Tidak'}</td>
            <td style="padding:12px;border:1px solid #ccc;"><strong>Jemput Mobil</strong><br>${needsPickup ? 'Iya' : 'Tidak'}</td>
          </tr>
        </table>
      </div>

      <!-- RINCIAN PEMBAYARAN -->
      <div style="padding:24px;">
        <h3 style="margin-top:0;margin-bottom:12px;color:#f97316;">💰 Rincian Pembayaran</h3>
        <table width="100%" style="font-size:14px;">
          <tr>
            <td>Harga Sewa</td>
            <td align="right">Rp ${grandTotalBeforeDeposit.toLocaleString('id-ID')}</td>
          </tr>
          <tr>
            <td>Deposit</td>
            <td align="right">Rp ${dps.toLocaleString('id-ID')}</td>
          </tr>
          ${needsTrip ? `<tr><td>Biaya Luar Kota</td><td align="right">Rp ${tf.toLocaleString('id-ID')}</td></tr>` : ''}
          ${needsDriver ? `<tr><td>Biaya Supir</td><td align="right">Rp ${df.toLocaleString('id-ID')}</td></tr>` : ''}
          ${needsDelivery ? `<tr><td>Biaya Antar</td><td align="right">Rp ${dlf.toLocaleString('id-ID')}</td></tr>` : ''}
          ${needsPickup ? `<tr><td>Biaya Jemput</td><td align="right">Rp ${puf.toLocaleString('id-ID')}</td></tr>` : ''}
          <tr style="border-top:1px solid #ccc;">
            <td><strong>Total Sebelum Diskon</strong></td>
            <td align="right">Rp ${grandTotalBeforeDiscount.toLocaleString('id-ID')}</td>
          </tr>
          ${discount > 0 ? `
            <tr>
              <td>Diskon</td>
              <td align="right">- Rp ${disc.toLocaleString('id-ID')}</td>
            </tr>` : ''}
          <tr style="font-weight:bold;">
            <td><strong>Total Setelah Diskon</strong></td>
            <td align="right"><strong>Rp ${grandTotalAfterDiscount.toLocaleString('id-ID')}</strong></td>
          </tr>
        </table>
      </div>

      <!-- DOT LINE BAWAH -->
      <div style="border-top: 2px dotted #ccc; width: 100%; margin: 0;"></div>

      <!-- FOOTER -->
      <div style="background-color:#f1f1f1;padding:12px;text-align:center;font-size:12px;color:#888;">
        Email ini dikirim otomatis. Mohon untuk tidak membalas secara langsung.
      </div>

    </div>
  </div>
  `;
}

module.exports = { generateInvoiceEmail };
