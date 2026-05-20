const fs = require('fs');
const f = 'SuperAdminPage.jsx';

// Read as latin1 to get the raw bytes as characters
const content = fs.readFileSync(f, 'latin1');

// The file was originally UTF-8 but PowerShell read it as ANSI (Windows-1252/latin1)
// and re-saved it, causing double-encoding.
// We need to encode back to latin1 bytes (which are actually the original UTF-8 bytes)
const restored = Buffer.from(content, 'latin1');

// Verify it's valid UTF-8
try {
  const test = restored.toString('utf8');
  // Check if the em dash is present correctly
  if (test.includes('\u2014') || test.includes('\u20b9') || test.includes('\ud83d')) {
    console.log('Good: looks like valid UTF-8 with emoji/special chars');
  } else {
    console.log('Warning: may still have issues');
  }
  console.log('Line 30:', test.split('\n')[29].substring(0, 80));
  fs.writeFileSync(f, restored);
  console.log('Written', restored.length, 'bytes');
} catch(e) {
  console.error('Not valid UTF-8:', e.message);
}
