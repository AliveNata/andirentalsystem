const { test } = require('node:test');
const assert = require('node:assert/strict');
const multer = require('multer');
const { sniffFileType, isMalformedMultipart } = require('../lib/uploads');

test('truncated or malformed multipart bodies count as client errors', () => {
  // Arrange
  const truncated = new Error('Unexpected end of form');
  const badHeader = new Error('Malformed part header');
  const limit = new multer.MulterError('LIMIT_FILE_SIZE', 'ktpFile');
  const disk = Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });

  // Act
  const results = [truncated, badHeader, limit, disk].map(isMalformedMultipart);

  // Assert
  assert.deepEqual(results, [true, true, false, false]);
});

test('detects JPEG, PNG and PDF by magic bytes', () => {
  // Arrange
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pdf = Buffer.from('%PDF-1.7');

  // Act
  const types = [jpeg, png, pdf].map(sniffFileType);

  // Assert
  assert.deepEqual(types, ['jpeg', 'png', 'pdf']);
});

test('rejects HTML, Windows executables, WEBP and empty files', () => {
  // Arrange
  const html = Buffer.from('<html><b>x</b>');
  const exe = Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]);
  const webp = Buffer.from('RIFF\0\0\0\0WEBP');
  const empty = Buffer.alloc(0);

  // Act
  const types = [html, exe, webp, empty].map(sniffFileType);

  // Assert
  assert.deepEqual(types, [null, null, null, null]);
});
