#!/usr/bin/env node
/**
 * validate-encoding.cjs
 * Scans all JSX/JS/CSS source files and detects UTF-8 mojibake
 * (double/triple encoded UTF-8 that happened when PowerShell read UTF-8 as Windows-1252).
 *
 * Run: node validate-encoding.cjs
 * Exit code 0 = clean, 1 = encoding corruption found.
 *
 * Add to package.json scripts:
 *   "validate": "node validate-encoding.cjs"
 *   "prebuild": "node validate-encoding.cjs"
 */

const fs   = require('fs');
const path = require('path');

const SRC_DIR   = path.join(__dirname, 'src');
const EXTS      = new Set(['.jsx', '.tsx', '.js', '.ts', '.css', '.scss', '.json', '.html']);

// Mojibake signatures:
//   C3 83 = UTF-8 for Ã  → appears when U+00C3 (itself a mojibake char) gets double-encoded
//   C3 A2 = UTF-8 for â  → appears when E2 (start of many 3-byte UTF-8 seqs) gets mojibake-encoded
//   C2 80-BF appearing in clusters after C3-bytes are also a sign of double-encoding
const MOJIBAKE_PATTERNS = [
  Buffer.from([0xC3, 0x83, 0xC2]),   // ÃÂ sequence = strong triple-encode indicator
  Buffer.from([0xC3, 0xA2, 0xC2]),   // â sequence = double-encode of â (E2 byte)
  Buffer.from([0xC3, 0x83, 0xC3]),   // ÃÃ = very strong indicator
];

// U+FFFD replacement char as UTF-8 bytes
const REPLACEMENT_CHAR = Buffer.from([0xEF, 0xBF, 0xBD]);

function containsMojibake(buf) {
  for (const pattern of MOJIBAKE_PATTERNS) {
    if (buf.includes(pattern)) return true;
  }
  if (buf.includes(REPLACEMENT_CHAR)) return true;
  return false;
}

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
        walk(full, results);
      }
    } else if (entry.isFile() && EXTS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

const files  = walk(SRC_DIR);
const broken = [];

for (const file of files) {
  const buf = fs.readFileSync(file);
  if (containsMojibake(buf)) {
    broken.push(path.relative(SRC_DIR, file));
  }
}

if (broken.length === 0) {
  console.log('✅  Encoding check passed — all source files are clean UTF-8.');
  process.exit(0);
} else {
  console.error('❌  Encoding corruption detected in the following files:');
  for (const f of broken) {
    console.error(`   • src/${f}`);
  }
  console.error('');
  console.error('HOW TO FIX:');
  console.error('  Run: node fix_super_admin_encoding.cjs');
  console.error('');
  console.error('HOW TO PREVENT:');
  console.error('  Never use PowerShell redirection (>) to write to source files.');
  console.error('  Always open files in VS Code — it uses UTF-8 per .editorconfig.');
  console.error('  If using PowerShell, always add: -Encoding UTF8');
  process.exit(1);
}
