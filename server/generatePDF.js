const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // install via: npm install node-fetch

async function generatePDF() {
  // 1. Baca HTML template
  const htmlPath = path.resolve(__dirname, './terms_template.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // 2. Fetch logo dari backend (index.js)
  const res = await fetch('http://localhost:5000/api/web-config/logo');
  const data = await res.json();
  const logoUrl = data?.url_image || 'https://dummyimage.com/100x100/ccc/fff&text=Logo';

  // 3. Replace [LOGO] placeholder di HTML
  html = html.replace('[LOGO]', logoUrl);

  // 4. Generate PDF pakai Puppeteer
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const outputPath = path.resolve(__dirname, '../public/terms_and_conditions.pdf');
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
  });

  await browser.close();
  console.log('✅ PDF berhasil dibuat:', outputPath);
}

generatePDF().catch(console.error);
