const fs = require('fs');
let content = fs.readFileSync('src/pages/SuperAdminPage.jsx', 'utf8');

// Fix line 1331: form.maintenance_mode ? '🔴 ENABLED' : 'Disabled'
// The broken pattern is: form.maintenance_mode ????? ENABLED' : 'Disabled'
// where ??? is broken emoji chars mixed with ? from the ternary

// Find the exact broken pattern and replace
const lines = content.split('\n');
let fixed = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('form.maintenance_mode') && lines[i].includes('ENABLED') && lines[i].includes('Disabled')) {
    console.log('Found at line', i+1, ':', lines[i].substring(0, 200));
    // Replace the whole ternary expression
    lines[i] = lines[i].replace(
      /\{form\.maintenance_mode[^?]*\?[^:]*ENABLED[^}]*\}/,
      '{form.maintenance_mode ? "🔴 ENABLED" : "Disabled"}'
    );
    console.log('Fixed to:', lines[i].substring(0, 200));
    fixed++;
  }
}

if (fixed > 0) {
  content = lines.join('\n');
  fs.writeFileSync('src/pages/SuperAdminPage.jsx', content, 'utf8');
  console.log('File saved with', fixed, 'fixes');
} else {
  console.log('Pattern not found - checking raw context...');
  // Print lines 1328-1334
  for (let i = 1327; i < 1334; i++) {
    console.log(i+1, ':', lines[i] ? lines[i].replace(/[^\x20-\x7E]/g, '[NC]').substring(0,180) : '(empty)');
  }
}
