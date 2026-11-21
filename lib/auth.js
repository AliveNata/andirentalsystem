// req.session.user = { id: uuid, username, level: 'superadmin' | 'admin' | 'manajemen' }
const pool = require('../db');

const MANAGERS = ['superadmin', 'manajemen'];
const ASSIGNABLE_LEVELS = ['admin', 'manajemen'];
const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://localhost:5180'];

const SESSION_COOKIE = 'armj.sid';
const COOKIE_OPTIONS = { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' };

const PUBLIC_API = new Set([
  'POST /api/login',
  'GET /api/me',
  'POST /api/logout',
  'GET /api/web-config/logo',
  'GET /api/web-config/public',
]);

const UNAUTHORIZED = { message: 'Sesi berakhir. Silakan login lagi.' };
const FORBIDDEN = { message: 'Akses ditolak untuk level akun ini.' };
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function endSession(req, res) {
  req.session.destroy((err) => {
    if (err) console.error('Gagal mengakhiri sesi akun yang sudah tidak ada:', err);
    res.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);
    res.status(401).json(UNAUTHORIZED);
  });
}

// The session only remembers who logged in; level comes from dim_user on every request,
// so a demoted or deleted account loses access on its next call, not after 8 hours.
async function refreshSessionUser(req) {
  const { rows } = await pool.query('select id, username, level from dim_user where id = $1', [req.session.user.id]);
  const current = rows[0];
  if (!current) return null;
  const cached = req.session.user;
  if (cached.username !== current.username || cached.level !== current.level) {
    req.session.user = { id: current.id, username: current.username, level: current.level };
  }
  return req.session.user;
}

async function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json(UNAUTHORIZED);
  try {
    const user = await refreshSessionUser(req);
    if (!user) return endSession(req, res);
    return next();
  } catch (err) {
    console.error('Gagal memeriksa sesi:', err);
    return res.status(500).json({ message: 'Terjadi kesalahan di server.' });
  }
}

function requireRole(...levels) {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) return res.status(401).json(UNAUTHORIZED);
    if (!levels.includes(user.level)) return res.status(403).json(FORBIDDEN);
    return next();
  };
}

// Who is acting. Always the session, never body, header or query.
function actor(req) {
  const { id, username, level } = req.session.user;
  return { id, username, level };
}

// Default deny for everything under /api, so a new or forgotten route stays closed.
function apiGate(req, res, next) {
  const key = `${req.method} ${(req.baseUrl + req.path).toLowerCase()}`;
  if (PUBLIC_API.has(key)) return next();
  return requireAuth(req, res, next);
}

// Browsers always send Origin on cross-site writes; curl and server-to-server calls do not
// and are still covered by the session check.
function sameOriginWrites(allowed = ALLOWED_ORIGINS) {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    if (origin && !allowed.includes(origin)) return res.status(403).json(FORBIDDEN);
    return next();
  };
}

// Returns a FORBIDDEN reason, or null when the actor may change the target account.
function employeeChangeDenied(who, target, { level, isDelete = false } = {}) {
  if (target.level === 'superadmin' && who.level !== 'superadmin') return 'Akun superadmin hanya bisa diubah oleh superadmin.';
  if (target.id === who.id && isDelete) return 'Tidak bisa menghapus akun sendiri.';
  if (target.id === who.id && level !== undefined && level !== target.level) return 'Tidak bisa mengubah level akun sendiri.';
  return null;
}

// Log rows written before T10 still hold dim_user.password inside before/after.
function redactLogChanges(changes) {
  if (!changes || typeof changes !== 'object') return changes;
  const out = { ...changes };
  for (const key of ['before', 'after']) {
    if (out[key] && typeof out[key] === 'object' && 'password' in out[key]) {
      const copy = { ...out[key] };
      delete copy.password;
      out[key] = copy;
    }
  }
  return out;
}

module.exports = {
  requireAuth,
  requireRole,
  actor,
  apiGate,
  refreshSessionUser,
  sameOriginWrites,
  employeeChangeDenied,
  redactLogChanges,
  MANAGERS,
  ASSIGNABLE_LEVELS,
  ALLOWED_ORIGINS,
  PUBLIC_API,
  SESSION_COOKIE,
  COOKIE_OPTIONS,
};
