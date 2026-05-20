const fs = require('fs');
const c = fs.readFileSync('src/pages/SuperAdminPage.jsx', 'utf8');
const lines = c.split('\n');
const issues = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if ((l.includes("'??") || l.includes('"??') || (l.includes('??') && (l.includes('label') || l.includes('title') || l.includes('icon')))) && !l.trimStart().startsWith('//')) {
    issues.push((i+1) + ': ' + l.trim().replace(/[^\x20-\x7E\u20b9\u2014]/g, '[NC]').substring(0, 150));
  }
}
fs.writeFileSync('remaining_issues.txt', issues.join('\n'));
console.log('Found', issues.length, 'issues');
