// Contact details from the user's decision (K7, 3e) and the official website.
const ADMIN_WHATSAPP = { display: '0812-1959-7989', waLink: 'https://wa.me/6281219597989' };

const BRAND_NAME = 'Andi Rental Mobil';
const COMPANY_NAME = 'PT Handi Berkah Sejati Abadi';
const COMPANY_EMAIL = 'info@andirentalmobil.co.id';
const COMPANY_ADDRESS = 'Jl. Tongkol No. 8, Kel. Tanjung Priok, Kec. Tanjung Priok, Jakarta Utara 14310';

// Fallback only: admins set the signatory in Pengaturan Web (dim_web_config), and index.js
// uses these when that is empty. The receipt drops empty lines, so never fill them with a guess.
const SIGNATORY = { name: null, title: null };
const DEPOSIT_RETURN_NOTE = null;

module.exports = {
  ADMIN_WHATSAPP,
  BRAND_NAME,
  COMPANY_NAME,
  COMPANY_EMAIL,
  COMPANY_ADDRESS,
  SIGNATORY,
  DEPOSIT_RETURN_NOTE,
};
