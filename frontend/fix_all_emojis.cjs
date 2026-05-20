/**
 * FINAL comprehensive emoji fix for SuperAdminPage.jsx
 * Replaces all remaining ?? placeholder strings with correct emoji based on context.
 */
const fs = require('fs');
let c = fs.readFileSync('src/pages/SuperAdminPage.jsx', 'utf8');

const fixes = [
  // Modal titles
  ["'?? Create New Tenant (Paid Account)'", "'🏢 Create New Tenant (Paid Account)'"],
  [">?? Create New Tenant (Paid Account)<", ">🏢 Create New Tenant (Paid Account)<"],
  
  // Card titles in modal
  [">?? Account Details<", ">👤 Account Details<"],
  [">?? Subscription Plan<", ">📋 Subscription Plan<"],
  
  // Plan includes label
  ["'>?? {selPlan.label} Plan Includes:<", "'>✨ {selPlan.label} Plan Includes:<"],
  [">{selPlan.label} Plan Includes:", ">✨ {selPlan.label} Plan Includes:"],
  
  // Buttons
  ["'?? Create Tenant Account'", "'🏢 Create Tenant Account'"],
  ["'?? Save Changes'", "'💾 Save Changes'"],
  ["'?? Save Branding Settings'", "'💾 Save Branding Settings'"],
  ["'?? Save SEO Settings'", "'💾 Save SEO Settings'"],
  ["'?? Save Homepage Settings'", "'💾 Save Homepage Settings'"],
  ["'?? Save Invoice Settings'", "'💾 Save Invoice Settings'"],
  ["'?? Save Platform Settings'", "'💾 Save Platform Settings'"],

  // Module permissions icon list
  ["{ key: 'cases',         label: 'Cases',          icon: '??' },", "{ key: 'cases',         label: 'Cases',          icon: '📁' },"],
  ["{ key: 'clients',       label: 'Clients',         icon: '??' },", "{ key: 'clients',       label: 'Clients',         icon: '👥' },"],
  ["{ key: 'inventory',     label: 'Inventory',       icon: '??' },", "{ key: 'inventory',     label: 'Inventory',         icon: '📦' },"],
  ["{ key: 'accounting',    label: 'Accounting',      icon: '??' },", "{ key: 'accounting',    label: 'Accounting',         icon: '💰' },"],
  ["{ key: 'knowledge_base',label: 'Knowledge Base',  icon: '??' },", "{ key: 'knowledge_base',label: 'Knowledge Base',       icon: '📚' },"],
  ["{ key: 'recycle_bin',   label: 'Recycle Bin',     icon: '????' },", "{ key: 'recycle_bin',   label: 'Recycle Bin',         icon: '🗑️' },"],
  ["{ key: 'webhooks',      label: 'Webhooks',        icon: '??' },", "{ key: 'webhooks',      label: 'Webhooks',             icon: '🔗' },"],

  // Plans/Permissions tabs
  ["{v:'plans',label:'?? Plans'}", "{v:'plans',label:'📋 Plans'}"],
  ["{v:'permissions',label:'?? Permissions & Access'}", "{v:'permissions',label:'🔒 Permissions & Access'}"],

  // Razorpay section titles
  [">?? API Credentials<", ">🔑 API Credentials<"],
  [">?? Webhook Configuration<", ">🔗 Webhook Configuration<"],
  [">?? Integration Guide<", ">📖 Integration Guide<"],
  ["m === 'live' ? '?? Live' : '?? Test'", "m === 'live' ? '🟢 Live' : '🧪 Test'"],
  
  // Coupon code gen button
  ["title=\"Auto-generate\">??<", "title=\"Auto-generate\">🎲<"],

  // Branding section titles
  [">?? Platform Identity<", ">🔒 Platform Identity<"],
  [">?? Contact & Legal<", ">📞 Contact & Legal<"],
  [">?? Social Links<", ">🔗 Social Links<"],

  // SEO section titles
  [">?? Core Meta Tags<", ">🏷️ Core Meta Tags<"],
  ["'?? Auto-generate XML Sitemap'", "'🗺️ Auto-generate XML Sitemap'"],

  // Announcement
  ["announcement_text: '?? New: WhatsApp notifications now available!'", "announcement_text: '🔔 New: WhatsApp notifications now available!'"],

  // Homepage feature cards  
  ["{ icon: '??', title: 'Case Management'", "{ icon: '📁', title: 'Case Management'"],
  ["{ icon: '??', title: 'Billing & Invoicing'", "{ icon: '💰', title: 'Billing & Invoicing'"],
  ["{ icon: '??', title: 'Inventory & Donors'", "{ icon: '📦', title: 'Inventory & Donors'"],

  // Homepage section titles
  [">?? Announcement Banner<", ">📢 Announcement Banner<"],
  [">?? Hero Section<", ">🖼️ Hero Section<"],
  [">?? Section Visibility<", ">👁️ Section Visibility<"],
  ["'?? Pricing / Plans Section'", "'💰 Pricing / Plans Section'"],
  ["'?? Features Grid Section'", "'⚡ Features Grid Section'"],
  [">?? Feature Cards<", ">⚡ Feature Cards<"],

  // Platform/Invoice settings
  [">?? Invoice & Auto-Activation Settings<", ">📄 Invoice & Auto-Activation Settings<"],
  ["'?? Auto-send invoice email on payment success'", "'📧 Auto-send invoice email on payment success'"],
  [">?? Generated Invoices (", ">📄 Generated Invoices ("],

  // SA Accounts role labels
  ["super_admin: '?? Super Admin'", "super_admin: '👑 Super Admin'"],
  ["support_admin: '?? Support Admin'", "support_admin: '🎧 Support Admin'"],
  ["billing_admin: '?? Billing Admin'", "billing_admin: '💳 Billing Admin'"],
  ["full: '?? Full Access'", "full: '🔓 Full Access'"],
  ["billing_only: '?? Billing Only'", "billing_only: '💳 Billing Only'"],
  ["view_only: '?? View Only'", "view_only: '👁️ View Only'"],
  
  // Role icons in list
  ["acc.role === 'super_admin' ? '??'", "acc.role === 'super_admin' ? '👑'"],
  ["acc.role === 'billing_admin' ? '??'", "acc.role === 'billing_admin' ? '💳'"],
  [": '??'}", ": '👤'}"],
  
  // Search icon
  ["className=\"search-icon\">??<", "className=\"search-icon\">🔍<"],

  // Platform settings titles
  [">?? System Health<", ">🔧 System Health<"],
  [">?? Maintenance Mode<", ">⚙️ Maintenance Mode<"],
  [">?? SMTP Email Configuration<", ">📧 SMTP Email Configuration<"],
  [">?? Default Limits for New Tenants<", ">⚙️ Default Limits for New Tenants<"],

  // Subscribers section titles
  [">?? Subscription Plans & Access Control<", ">📋 Subscription Plans & Access Control<"],
  [">?? Subscription Purchase Tracker<", ">💳 Subscription Purchase Tracker<"],
  ["'??', 'Total Revenue'", "'💰', 'Total Revenue'"],
  
  // Empty state icons
  ['<div className="empty-icon">??</div>', '<div className="empty-icon">📭</div>'],
  
  // schema.org
  ["'?? Schema.org Structured", "'📋 Schema.org Structured"],
  ["Schema.org Structured Data", "Schema.org Structured Data"],
];

let count = 0;
for (const [broken, fixed] of fixes) {
  if (c.includes(broken)) {
    c = c.split(broken).join(fixed);
    count++;
  }
}

// Catch any remaining ?? that are standalone (not in logic) — replace with generic icon
const remaining = (c.match(/['"][?][?]['"]|>[?][?]<|>[?][?][?][?]</g) || []).length;

fs.writeFileSync('src/pages/SuperAdminPage.jsx', c, 'utf8');
console.log(count + ' pattern fixes applied, ' + remaining + ' patterns may remain');

// Verify count
const left = (c.match(/\?\?/g) || []).length;
console.log('Total ?? still in file:', left);
