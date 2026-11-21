const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Used for every dynamic value, in text and in attributes alike.
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

// Returns an escaped http(s) URL or null. Callers skip the whole <img>/<a> on null
// so no element ever renders with an empty or javascript: src.
function safeUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  return escapeHtml(parsed.href);
}

// Images in an email are fetched by the mail client from the open internet, so only https counts.
function safeImageUrl(value) {
  const url = safeUrl(value);
  return url && url.startsWith('https://') ? url : null;
}

const RUPIAH = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

// 'Rp1.500.000': no space, so the prefix and amount never wrap apart (receipt design 4.4).
function formatRupiah(value) {
  return 'Rp' + RUPIAH.format(Number(value || 0));
}

// DATE columns are read as YYYY-MM-DD strings and formatted in UTC so the day
// never shifts with the server time zone.
function formatDateId(value) {
  if (value === null || value === undefined || value === '') return '';
  const opts = { day: 'numeric', month: 'long', year: 'numeric' };
  if (value instanceof Date) {
    return value.toLocaleDateString('id-ID', { ...opts, timeZone: 'Asia/Jakarta' });
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return String(value);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString('id-ID', { ...opts, timeZone: 'UTC' });
}

// '09:00:00' becomes '09.00 WIB', the Indonesian way of writing clock time.
function formatTimeId(value) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value || ''));
  return match ? `${match[1]}.${match[2]} WIB` : '';
}

function formatDateTimeId(date) {
  const day = formatDateId(date);
  const time = date.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
  }).replace(':', '.');
  return `${day}, ${time} WIB`;
}

// Header injection guard: a booking code must never add lines to the subject.
function safeSubject(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

module.exports = {
  escapeHtml,
  safeUrl,
  safeImageUrl,
  formatRupiah,
  formatDateId,
  formatTimeId,
  formatDateTimeId,
  safeSubject,
};
