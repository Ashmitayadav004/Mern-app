const fs = require('fs');
let c = fs.readFileSync('src/pages/SuperAdminPage.jsx', 'utf8');
const lines = c.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('form.maintenance_mode') && lines[i].includes('ENABLED')) {
    console.log('Found at line', i + 1);
    console.log('Before:', JSON.stringify(lines[i]).substring(0, 300));
    
    // Replace the entire ternary expression - find the span tag and rebuild just that expression
    // Pattern: {form.maintenance_mode ? [ANYTHING] ENABLED [ANYTHING] : [ANYTHING] Disabled [ANYTHING]}
    lines[i] = lines[i].replace(
      /\{form\.maintenance_mode[^}]+ENABLED[^}]+\}/,
      "{form.maintenance_mode ? '\uD83D\uDD34 ENABLED' : 'Disabled'}"
    );
    
    console.log('After: ', JSON.stringify(lines[i]).substring(0, 300));
    break;
  }
}

c = lines.join('\n');
fs.writeFileSync('src/pages/SuperAdminPage.jsx', c, 'utf8');
console.log('Saved.');
