const fs = require('fs');
let c = fs.readFileSync('src/pages/SuperAdminPage.jsx', 'utf8');

const fixes = [
  // Line 151 - Plan includes label with variable
  ["}>?? {selPlan.label} Plan Includes:", "}>✨ {selPlan.label} Plan Includes:"],
  
  // Line 1031 - show_testimonials with ??
  ["'?? Testimonials Section'", "'⭐ Testimonials Section'"],
  ["'?? Testimonials'", "'⭐ Testimonials'"],
  // Also catch any other ?? in that array context
  [", '?? Features Grid Section']", ", '⚡ Features Grid Section']"],
  [", '?? Pricing / Plans Section']", ", '💰 Pricing / Plans Section']"],
];

let count = 0;
for (const [broken, fixed] of fixes) {
  if (c.includes(broken)) {
    c = c.split(broken).join(fixed);
    count++;
  }
}

// Scan for any remaining visible ?? in JSX strings/templates
const lines = c.split('\n');
let remaining_visible = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('??') && !lines[i].trimStart().startsWith('//') && !lines[i].includes('===') && !lines[i].includes('!==') && lines[i].match(/'[^']*\?\?|"[^"]*\?\?|>[^<]*\?\?/)) {
    console.log('Still has ??:', (i+1), lines[i].trim().replace(/[^\x20-\x7E\u20b9]/g,'[NC]').substring(0,120));
    remaining_visible++;
  }
}

fs.writeFileSync('src/pages/SuperAdminPage.jsx', c, 'utf8');
console.log(count, 'fixes applied,', remaining_visible, 'visible ?? remain');
