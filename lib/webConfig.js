// Pengaturan Web is a fixed set of keys. Rows in dim_web_config are keyed by `description`,
// so these labels are the storage contract: renaming one orphans the saved value.
const WEB_CONFIG_FIELDS = [
  { key: 'logo', description: 'Logo', type: 'url' },
  { key: 'favicon', description: 'Favicon', type: 'url' },
  { key: 'signature', description: 'Tanda Tangan', type: 'url' },
  { key: 'signatoryName', description: 'Nama Penandatangan', type: 'text' },
  { key: 'signatoryTitle', description: 'Jabatan Penandatangan', type: 'text' },
];

// Readable before login. Anything added here is visible to the whole internet.
const PUBLIC_KEYS = ['logo', 'favicon'];

const TEXT_MAX = 100;
const URL_MAX = 2048;

const FIELD_BY_KEY = new Map(WEB_CONFIG_FIELDS.map((f) => [f.key, f]));
const FIELD_BY_DESCRIPTION = new Map(WEB_CONFIG_FIELDS.map((f) => [f.description.toLowerCase(), f]));

// https only: the email templates (htmlSafe.cjs safeImageUrl) drop anything else,
// so an http logo or signature would vanish from invoices and receipts without warning.
function isHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

// Returns { values } where each value is a trimmed string or null (null = remove the row),
// or { error } with a message safe to show the admin. Keys absent from the body are left alone.
function parseWebConfigInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Data pengaturan web tidak valid.' };
  }
  const keys = Object.keys(body);
  if (keys.length === 0) return { error: 'Tidak ada pengaturan web yang dikirim.' };

  const unknown = keys.filter((k) => !FIELD_BY_KEY.has(k));
  if (unknown.length > 0) return { error: `Pengaturan tidak dikenal: ${unknown.join(', ')}.` };

  const values = {};
  for (const key of keys) {
    const field = FIELD_BY_KEY.get(key);
    const raw = body[key];
    if (raw === null || raw === undefined) {
      values[key] = null;
      continue;
    }
    if (typeof raw !== 'string') return { error: `${field.description} harus berupa teks.` };
    const value = raw.trim();
    if (!value) {
      values[key] = null;
      continue;
    }
    if (field.type === 'url') {
      if (value.length > URL_MAX) return { error: `URL ${field.description} terlalu panjang.` };
      if (!isHttpsUrl(value)) return { error: `URL ${field.description} harus diawali https://.` };
    } else if (value.length > TEXT_MAX) {
      return { error: `${field.description} maksimal ${TEXT_MAX} karakter.` };
    } else if (CONTROL_CHARS.test(value)) {
      return { error: `${field.description} berisi karakter yang tidak diizinkan, misalnya tab atau baris baru.` };
    }
    values[key] = value;
  }
  return { values };
}

function emptyConfig() {
  return Object.fromEntries(WEB_CONFIG_FIELDS.map((f) => [f.key, null]));
}

// Description match is case-insensitive so a legacy 'logo' row still counts as Logo.
function rowsToConfig(rows) {
  const config = emptyConfig();
  for (const row of rows || []) {
    const field = FIELD_BY_DESCRIPTION.get(String(row.description || '').trim().toLowerCase());
    if (!field) continue;
    const raw = field.type === 'url' ? row.url_image : row.value_text;
    const value = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    // Rows saved before the https rule may hold http or junk; treat them as unset.
    config[field.key] = field.type === 'url' && value && !isHttpsUrl(value) ? null : value;
  }
  return config;
}

function publicConfig(config) {
  return Object.fromEntries(PUBLIC_KEYS.map((k) => [k, config[k] ?? null]));
}

// Each part falls back on its own, so a name without a title still prints the name.
function signatoryFrom(config, fallback = { name: null, title: null }) {
  return {
    name: config.signatoryName || fallback?.name || null,
    title: config.signatoryTitle || fallback?.title || null,
  };
}

module.exports = {
  WEB_CONFIG_FIELDS,
  PUBLIC_KEYS,
  TEXT_MAX,
  FIELD_BY_KEY,
  isHttpsUrl,
  parseWebConfigInput,
  rowsToConfig,
  publicConfig,
  signatoryFrom,
  emptyConfig,
};
