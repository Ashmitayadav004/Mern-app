const fs = require('fs');
let c = fs.readFileSync('src/pages/SuperAdminPage.jsx', 'utf8');
const lines = c.split('\n');

// Fix line 1633 — the hero header comment with broken chars
// Replace: {/* [BAD] Hero Header [BAD] */}
// With: {/* Hero Header */}
let fixed = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Hero Header') && lines[i].includes('*/}')) {
    const original = lines[i];
    lines[i] = lines[i].replace(/\{\/\*.*?Hero Header.*?\*\/\}/, '{/* Hero Header */}');
    if (lines[i] !== original) {
      console.log('Fixed line', i+1);
      fixed++;
    }
  }
  // Also fix line 1331 if it still has broken chars
  if (lines[i].includes('maintenance_mode') && lines[i].includes('ENABLED') && lines[i].match(/[^\x00-\x7F]{2,}/)) {
    lines[i] = lines[i].replace(/[^\x00-\x7F\u20b9\u2014\u2500-\u2590\u25A0-\u27BF\u2B00-\u2BFF\uFE00-\uFEFF\u{1F000}-\u{1FFFF}]*ENABLED/u, '"🔴 ENABLED"');
    console.log('Fixed maintenance_mode line', i+1);
    fixed++;
  }
}

if (fixed > 0) {
  c = lines.join('\n');
  fs.writeFileSync('src/pages/SuperAdminPage.jsx', c, 'utf8');
  console.log(fixed, 'fixes applied');
} else {
  console.log('Nothing fixed — checking line 1633 raw:');
  console.log(JSON.stringify(lines[1632]).substring(0, 100));
}
