const fs = require('fs');
const path = require('path');

const SAMPLES_DIR = path.join(__dirname, 'samples');
const MANIFEST = path.join(SAMPLES_DIR, 'manifest.json');

if (!fs.existsSync(SAMPLES_DIR)) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
  console.log('Created samples/ folder.');
}

const files = fs.readdirSync(SAMPLES_DIR)
  .filter(f => f.toLowerCase().endsWith('.dcm'))
  .sort();

if (files.length === 0) {
  console.log('No .dcm files found in samples/');
  console.log('Drop your .dcm files into the samples/ folder and run this again.');
  process.exit(0);
}

const manifest = files.map(name => ({
  name,
  label: guessLabel(name),
}));

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

console.log(`\nFound ${files.length} .dcm file(s) in samples/:\n`);
manifest.forEach(m => console.log(`  ${m.label.padEnd(20)} ${m.name}`));
console.log(`\nmanifest.json updated. Run: node server.js\n`);

function guessLabel(filename) {
  const n = filename.replace(/\.dcm$/i, '').replace(/[_\-\.]+/g, ' ').trim();
  const up = n.toUpperCase();
  let mod = '';
  if (up.includes('CT'))  mod = 'CT';
  else if (up.includes('MR') || up.includes('MRI')) mod = 'MR';
  else if (up.includes('XA') || up.includes('XR')) mod = 'XA';
  else if (up.includes('US')) mod = 'US';
  else if (up.includes('PT') || up.includes('PET')) mod = 'PT';
  else if (up.includes('CR') || up.includes('DX')) mod = 'CR';
  else if (up.includes('NM')) mod = 'NM';
  return mod ? `${mod} - ${n}` : n;
}
