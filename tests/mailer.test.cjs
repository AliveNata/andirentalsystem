const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const nodemailer = require('nodemailer');

const realCreateTransport = nodemailer.createTransport;
const saved = { ...process.env };
let sent;

function freshMailer() {
  delete require.cache[require.resolve('../lib/mailer')];
  return require('../lib/mailer');
}

beforeEach(() => {
  sent = [];
  // jsonTransport builds the message in memory and never opens a socket.
  nodemailer.createTransport = () => {
    const transport = realCreateTransport({ jsonTransport: true });
    const original = transport.sendMail.bind(transport);
    transport.sendMail = async (msg) => {
      const info = await original(msg);
      sent.push(JSON.parse(info.message));
      return info;
    };
    return transport;
  };
});

afterEach(() => {
  nodemailer.createTransport = realCreateTransport;
  process.env = { ...saved };
});

test('sendMail receives the plain text part next to the html', async () => {
  // Arrange
  delete process.env.EMAIL_DRY_RUN;
  const { deliverEmail } = freshMailer();

  // Act
  const result = await deliverEmail({
    kind: 'receipt', transactionId: 't1', to: 'qa@example.com', subject: 'S', html: '<p>H</p>', text: 'Teks polos',
  });

  // Assert
  assert.equal(result.dryRun, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].text, 'Teks polos');
  assert.equal(sent[0].html, '<p>H</p>');
});

test('dry-run writes the plain text next to the html and opens no transport', async () => {
  // Arrange
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mailer-test-'));
  process.env.EMAIL_DRY_RUN = '1';
  process.env.EMAIL_DRY_RUN_DIR = dir;
  const { deliverEmail } = freshMailer();

  // Act
  await deliverEmail({
    kind: 'receipt', transactionId: 't2', to: 'qa@example.com', subject: 'S', html: '<p>H</p>', text: 'Teks polos',
  });

  // Assert
  const files = fs.readdirSync(dir);
  const txt = files.find((f) => f.endsWith('-receipt-t2.txt'));
  assert.ok(txt, `no .txt in ${files.join(', ')}`);
  assert.equal(fs.readFileSync(path.join(dir, txt), 'utf8'), 'Teks polos');
  assert.equal(sent.length, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
