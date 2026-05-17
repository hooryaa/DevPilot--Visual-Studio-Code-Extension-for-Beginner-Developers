const fs = require('fs');
const path = require('path');

function walk(dir, cb) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {walk(full, cb);}
    else {cb(full);}
  }
}

const out = path.resolve(__dirname, '..', 'out');
if (!fs.existsSync(out)) {
  console.error('No out/ directory found — build first.');
  process.exit(2);
}

let found = 0;
walk(out, (file) => {
  if (!file.endsWith('.js') && !file.endsWith('.map')) {return;}
  const txt = fs.readFileSync(file, 'utf8');
  const re = /require\s*\(/g;
  let m;
  const lines = txt.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      if (found === 0) {console.log('Found require(...) occurrences in built files:');}
      console.log(`- ${path.relative(process.cwd(), file)}:${i+1}: ${lines[i].trim()}`);
      found++;
    }
  }
});

if (!found) {console.log('No require(...) occurrences found in out/ (good).');}
else {console.log(`Total occurrences: ${found}`);}
