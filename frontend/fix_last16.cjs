const fs = require('fs');
let c = fs.readFileSync('src/pages/SuperAdminPage.jsx', 'utf8');

const fixes = [
  // Line 443: warning span icon
  ["fontSize: '1.1rem' }}>??</span>", "fontSize: '1.1rem' }}>⚠️</span>"],
  
  // Line 516: Permissions button
  [">?? Permissions</button>", ">🔒 Permissions</button>"],
  
  // Line 532: another warning span  
  ["fontSize:'1.1rem'}}>??</span>", "fontSize:'1.1rem'}}>⚠️</span>"],
  
  // Line 635: Razorpay logo icon div
  ["fontSize:'1.4rem' }}>??</div>", "fontSize:'1.4rem' }}>💳</div>"],
  
  // Buttons
  [">?? Save & Verify</button>", ">✅ Save & Verify</button>"],
  [">?? Simulate Webhook</button>", ">🔗 Simulate Webhook</button>"],
  
  // Coupon type options
  [">?? Global (anyone can use)</option>", ">🌐 Global (anyone can use)</option>"],
  [">?? User-Specific</option>", ">👤 User-Specific</option>"],
  
  // Invoice buttons
  [">?? Export<", ">📊 Export<"],
  [">?? Send Test ", ">📧 Send Test "],
  [">?? Clear Logs</button>", ">🗑️ Clear Logs</button>"],
  [">?? Retry</button>", ">🔄 Retry</button>"],
  
  // inline ?? in alert/button text (remaining inline patterns)
  ["</button>??\n", "</button>"],
  [">?? Export CSV<", ">📊 Export CSV<"],
  
  // Invoice alert area  
  ["'?? Export<", "'📊 Export<"],
];

let count = 0;
for (const [broken, fixed] of fixes) {
  if (c.includes(broken)) {
    c = c.split(broken).join(fixed);
    count++;
  }
}

// Now handle the remaining auto_send and invoice patterns that use [NC] from encoding
// These are non-visible chars in the toggle label arrays - replace with emoji
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  if ((i === 1078 || i === 1103) && lines[i].includes('??')) {
    lines[i] = lines[i].replace(/'\?\?[\s]*/g, "'📧 ").replace(/'\?\?'/g, "'📧'");
    count++;
  }
  // Also fix line 1124-1125 (download/resend invoice buttons)
  if ((i === 1123 || i === 1124) && lines[i].includes('??')) {
    lines[i] = lines[i].replace(/>[\?\?]+\s*/g, '>📄 ').replace(/'\?\?[^']*'/g, m => m.replace(/\?\?/g, '📄'));
    count++;
  }
}
c = lines.join('\n');

fs.writeFileSync('src/pages/SuperAdminPage.jsx', c, 'utf8');
const totalLeft = (c.match(/\?\?/g) || []).length;
console.log(count + ' fixes applied. Total ?? remaining: ' + totalLeft);
