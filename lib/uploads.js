const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));

const DOCUMENT_FIELDS = [
  'ktpFile', 'simFile', 'kkFile', 'workOrStudentIdFile', 'parentKtpFile', 'spouseKtpFile',
  'personalIdFile', 'marriageDocFile', 'picKtpFile', 'picKkFile', 'companyNpwpFile',
  'companySiupFile', 'companyNibFile', 'companyPhotoFile', 'passportFile', 'kitasKitapFile',
  'visaFile', 'ticketFile', 'ticketHotelFile', 'housePhotoFile', 'workIdFile',
  'verificationVideoFile', 'optionalRequirementFile',
];

const DOC_FORMAT_MESSAGE = 'Format file tidak didukung. Gunakan JPG, JPEG, PNG, atau PDF.';

const KINDS = {
  document: {
    types: ['jpeg', 'png', 'pdf'],
    mimes: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
    fileSize: 1048576,
    files: DOCUMENT_FIELDS.length,
    sizeLabel: '1 MB',
    formatMessage: DOC_FORMAT_MESSAGE,
  },
  payment: {
    types: ['jpeg', 'png', 'pdf'],
    mimes: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
    fileSize: 1048576,
    files: 3,
    sizeLabel: '1 MB',
    formatMessage: DOC_FORMAT_MESSAGE,
  },
  carPhoto: {
    types: ['jpeg'],
    mimes: ['image/jpeg', 'image/jpg'],
    fileSize: 2621440,
    files: 4,
    sizeLabel: '2,5 MB',
    formatMessage: 'Format file tidak didukung. Gunakan JPG atau JPEG.',
  },
};

const TYPE_INFO = {
  jpeg: { ext: 'jpg', mime: 'image/jpeg' },
  png: { ext: 'png', mime: 'image/png' },
  pdf: { ext: 'pdf', mime: 'application/pdf' },
};

const SERVE_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
};
const SERVE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}\.(jpg|jpeg|png|pdf)$/i;

class UploadRejected extends Error {
  constructor(field) {
    super('Upload rejected');
    this.field = field;
  }
}

function sniffFileType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  return null;
}

// Neither the client file name nor its extension is ever used on disk.
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.part`),
});

const multers = Object.fromEntries(Object.entries(KINDS).map(([kind, cfg]) => [kind, multer({
  storage,
  limits: { fileSize: cfg.fileSize, files: cfg.files, fields: 100 },
  fileFilter: (req, file, cb) => {
    if (cfg.mimes.includes(file.mimetype)) return cb(null, true);
    return cb(new UploadRejected(file.fieldname));
  },
})]));

function listFiles(req) {
  if (!req.files) return req.file ? [req.file] : [];
  if (Array.isArray(req.files)) return req.files;
  return Object.values(req.files).flat();
}

async function removeFiles(files) {
  await Promise.all(files.map(async (file) => {
    try {
      await fs.promises.rm(file.path, { force: true });
    } catch (err) {
      console.error('Gagal menghapus file upload:', path.basename(file.path), err.code);
    }
  }));
}

function removeRequestFiles(req) {
  return removeFiles(listFiles(req));
}

async function deleteFileIfExists(name) {
  if (!name || typeof name !== 'string') return;
  const target = path.join(UPLOAD_DIR, path.basename(name));
  try {
    await fs.promises.rm(target, { force: true });
  } catch (err) {
    console.error('Gagal menghapus file lama:', path.basename(name), err.code);
  }
}

// busboy reports a truncated or malformed body as a plain Error with only a message to go on.
const MALFORMED_MULTIPART = [
  'Unexpected end of form',
  'Unexpected end of file',
  'Malformed part header',
  'Multipart: Boundary not found',
  'Malformed content type',
  'Missing Content-Type',
  'Request aborted',
  'Request closed',
];

function isMalformedMultipart(err) {
  return Boolean(err) && !(err instanceof multer.MulterError)
    && (MALFORMED_MULTIPART.includes(err.message) || /^Unsupported content type/.test(err.message || ''));
}

async function handleUploadError(err, req, res, kind) {
  await removeRequestFiles(req);
  if (res.headersSent) return;
  const cfg = KINDS[kind];
  if (err instanceof UploadRejected) {
    return res.status(400).json({ message: cfg.formatMessage, field: err.field });
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: `Ukuran file melebihi ${cfg.sizeLabel}.`, field: err.field });
    }
    return res.status(400).json({ message: 'Upload tidak valid.', field: err.field });
  }
  if (isMalformedMultipart(err)) {
    return res.status(400).json({ message: 'Upload tidak valid.' });
  }
  console.error('Upload error:', err);
  return res.status(500).json({ message: 'Gagal memproses upload.' });
}

async function readHead(filePath) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(8);
    const { bytesRead } = await handle.read(buf, 0, 8, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

// Windows can briefly hold the file after multer's write stream finishes.
async function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fs.promises.rename(from, to);
    } catch (err) {
      if (attempt >= 4 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

function verifyUploads(kind) {
  const cfg = KINDS[kind];
  return async (req, res, next) => {
    const files = listFiles(req);
    try {
      const sniffed = await Promise.all(files.map(async (file) => sniffFileType(await readHead(file.path))));
      const badIndex = sniffed.findIndex((type) => !type || !cfg.types.includes(type));
      if (badIndex !== -1) {
        await removeFiles(files);
        return res.status(400).json({ message: cfg.formatMessage, field: files[badIndex].fieldname });
      }
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const info = TYPE_INFO[sniffed[i]];
        const finalName = file.filename.replace(/\.part$/, `.${info.ext}`);
        const finalPath = path.join(path.dirname(file.path), finalName);
        await renameWithRetry(file.path, finalPath);
        file.filename = finalName;
        file.path = finalPath;
        file.mimetype = info.mime;
      }
      return next();
    } catch (err) {
      console.error('Gagal memeriksa file upload:', err);
      await removeFiles(files);
      return res.status(500).json({ message: 'Gagal memproses upload.' });
    }
  };
}

function runUpload(kind, mw) {
  return (req, res, next) => mw(req, res, (err) => (err ? handleUploadError(err, req, res, kind) : next()));
}

// Returns [multer, magic-byte check]; Express accepts the array as route middleware.
function uploadFields(kind, fields) {
  return [runUpload(kind, multers[kind].fields(fields)), verifyUploads(kind)];
}

function uploadArray(kind, field, maxCount) {
  return [runUpload(kind, multers[kind].array(field, maxCount)), verifyUploads(kind)];
}

const uploadDocuments = uploadFields('document', DOCUMENT_FIELDS.map((name) => ({ name, maxCount: 1 })));
const uploadPayment = uploadFields('payment', ['deposit', 'dp', 'full'].map((name) => ({ name, maxCount: 1 })));
const uploadCarPhotos = uploadFields('carPhoto', [{ name: 'image', maxCount: 4 }]);
const uploadCarPhotosArray = uploadArray('carPhoto', 'image', 4);

function serveUploadedFile(req, res) {
  const name = req.params.filename;
  const notFound = () => res.status(404).json({ message: 'File tidak ditemukan.' });
  if (typeof name !== 'string' || name !== path.basename(name) || /[\\/]/.test(name) || !SERVE_NAME.test(name)) {
    return notFound();
  }
  const headers = {
    'Content-Type': SERVE_TYPES[path.extname(name).toLowerCase()],
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `inline; filename="${name}"`,
    'Cache-Control': 'private, no-cache',
  };
  return res.sendFile(name, { root: UPLOAD_DIR, dotfiles: 'deny', headers }, (err) => {
    if (!err || res.headersSent) return;
    if (err.code === 'ENOENT' || err.status === 404) return notFound();
    console.error('Gagal mengirim file:', name, err.code || err.status);
    return res.status(500).json({ message: 'Gagal mengambil file.' });
  });
}

module.exports = {
  UPLOAD_DIR,
  DOCUMENT_FIELDS,
  KINDS,
  sniffFileType,
  isMalformedMultipart,
  verifyUploads,
  uploadDocuments,
  uploadPayment,
  uploadCarPhotos,
  uploadCarPhotosArray,
  removeRequestFiles,
  deleteFileIfExists,
  serveUploadedFile,
};
