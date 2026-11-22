// Env parsing that must fail at boot, not on the first request. Parsers throw so tests can
// call them; callers decide to exit.
const path = require('path');

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5180'];

// An Origin header is scheme://host[:port] with no path or trailing slash, so an entry that
// does not round-trip through URL().origin would never match and silently 403 every write.
function parseAllowedOrigins(raw, nodeEnv) {
  const entries = (raw || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (entries.length === 0) {
    if (nodeEnv === 'production') throw new Error('ALLOWED_ORIGINS wajib diisi saat NODE_ENV=production.');
    return DEV_ORIGINS;
  }
  for (const entry of entries) {
    let origin;
    try { origin = new URL(entry).origin; } catch { origin = null; }
    if (origin !== entry) throw new Error(`ALLOWED_ORIGINS tidak valid: "${entry}" (format: https://domain tanpa garis miring di akhir).`);
  }
  return entries;
}

// Number of proxy hops in front of the app. Empty or 0 keeps trust proxy off.
function parseTrustProxy(raw) {
  if (raw === undefined || raw.trim() === '') return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`TRUST_PROXY harus bilangan bulat >= 0, bukan "${raw}".`);
  return n;
}

// Without this check app.listen(undefined) picks a random port and the proxy points nowhere.
function parsePort(raw) {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 1 || n > 65535) throw new Error('PORT wajib diisi dengan nomor port 1-65535.');
  return n;
}

// The ./uploads default sits inside the app folder, which the container user cannot write to,
// so production must point at the mounted volume explicitly.
function parseUploadDir(raw, nodeEnv, devDefault) {
  const dir = (raw || '').trim();
  if (!dir) {
    if (nodeEnv === 'production') throw new Error('UPLOAD_DIR wajib diisi saat NODE_ENV=production (contoh: /data/uploads).');
    return path.resolve(devDefault);
  }
  return path.resolve(dir);
}

function orExit(parse) {
  try {
    return parse();
  } catch (err) {
    console.error(err.message);
    return process.exit(1);
  }
}

module.exports = { parseAllowedOrigins, parseTrustProxy, parsePort, parseUploadDir, orExit, DEV_ORIGINS };
