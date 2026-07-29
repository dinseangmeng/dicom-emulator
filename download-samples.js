const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SAMPLES_DIR = path.join(__dirname, 'samples');

const BASE = 'https://raw.githubusercontent.com/pydicom/pydicom-data/master/data_store/data';

const SOURCES = [
  { name: '693_J2KR.dcm',              label: 'CT J2K Lossless' },
  { name: '693_UNCI.dcm',              label: 'CT Uncompressed' },
  { name: '693_UNCR.dcm',              label: 'CT Uncompressed 2' },
  { name: 'HTJ2KLossless_08_RGB.dcm',  label: 'HTJ2K RGB' },
  { name: 'HTJ2K_08_RGB.dcm',          label: 'HTJ2K RGB 2' },
  { name: 'JLSL_08_07_0_1F.dcm',       label: 'JPEG-LS 8bit' },
  { name: 'JLSL_16_15_1_1F.dcm',       label: 'JPEG-LS 16bit' },
  { name: 'JLSL_RGB_ILV0.dcm',         label: 'JPEG-LS RGB ILV0' },
  { name: 'JLSL_RGB_ILV1.dcm',         label: 'JPEG-LS RGB ILV1' },
  { name: 'JLSL_RGB_ILV2.dcm',         label: 'JPEG-LS RGB ILV2' },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const proto = url.startsWith('https') ? https : http;

    function get(targetUrl) {
      const mod = targetUrl.startsWith('https') ? https : http;
      mod.get(targetUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', (err) => { if (fs.existsSync(dest)) fs.unlinkSync(dest); reject(err); });
      }).on('error', reject);
    }

    get(url);
  });
}

async function main() {
  if (!fs.existsSync(SAMPLES_DIR)) fs.mkdirSync(SAMPLES_DIR, { recursive: true });

  console.log(`\nDownloading ${SOURCES.length} DICOM samples from pydicom-data...\n`);

  const manifest = [];
  let ok = 0;

  for (const src of SOURCES) {
    const dest = path.join(SAMPLES_DIR, src.name);

    if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
      console.log(`  ✓ ${src.name} (cached)`);
      manifest.push({ name: src.name, label: src.label });
      ok++;
      continue;
    }

    const url = `${BASE}/${encodeURIComponent(src.name)}`;
    process.stdout.write(`  ↓ ${src.label} (${src.name})... `);
    try {
      await download(url, dest);
      const size = fs.statSync(dest).size;
      console.log(`✓ ${(size / 1024).toFixed(0)} KB`);
      manifest.push({ name: src.name, label: src.label });
      ok++;
    } catch (err) {
      console.log(`✗ ${err.message}`);
    }
  }

  fs.writeFileSync(
    path.join(SAMPLES_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\n${ok}/${SOURCES.length} samples ready in ./samples/`);
  if (ok > 0) console.log('Run: node server.js\n');
  else console.log('All failed — app will use synthetic images as fallback.\n');
}

main();
