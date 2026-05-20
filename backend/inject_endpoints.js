const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'src', 'demo-server.js');
let content = fs.readFileSync(serverFile, 'utf8');

const markerStr = "app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));";
const insertIdx = content.lastIndexOf(markerStr);

if (insertIdx === -1) {
  console.error('MARKER NOT FOUND. Search for "Endpoint not found" in file.');
  process.exit(1);
}

const newCode = `
// === TEAM CHAT ================================================================
const CHAT_MESSAGES = {};
const CHAT_ONLINE = new Map();
['general','engineers','billing','cases'].forEach(function(r) {
  CHAT_MESSAGES[r] = [{ id: 'seed_'+r, room: r, text: 'Welcome to #'+r+'! Welcome to RecoverLab Team Chat!', sender_id: 'system', sender_name: 'RecoverLab Bot', sender_role: 'system', created_at: new Date(Date.now()-3600000).toISOString() }];
});
app.get('/api/chat/messages', authenticate, function(req, res) {
  const room = req.query.room || 'general';
  const limit = parseInt(req.query.limit || '50');
  const user = [...DEMO_USERS,...TEAM_USERS,SUPER_ADMIN].find(function(u) { return u.id === req.user.userId; });
  if (user) CHAT_ONLINE.set(req.user.userId, { name: user.full_name||user.username, role: user.role, last_seen: Date.now() });
  const msgs = (CHAT_MESSAGES[room] || []).slice(-limit);
  res.json({ messages: msgs.map(function(m) { return Object.assign({}, m, { is_own: m.sender_id === req.user.userId }); }), room: room });
});
app.post('/api/chat/messages', authenticate, function(req, res) {
  const room = req.body.room || 'general';
  const text = req.body.text;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Message text required' });
  if (!['general','engineers','billing','cases'].includes(room)) return res.status(400).json({ error: 'Invalid room' });
  const user = [...DEMO_USERS,...TEAM_USERS,SUPER_ADMIN].find(function(u) { return u.id === req.user.userId; });
  const msg = { id: 'msg_'+Date.now()+'_'+Math.random().toString(36).slice(2,5), room: room, text: text.trim(), sender_id: req.user.userId, sender_name: (user&&(user.full_name||user.username))||req.user.username, sender_role: user&&user.role, avatar: user&&user.avatar||null, created_at: new Date().toISOString() };
  if (!CHAT_MESSAGES[room]) CHAT_MESSAGES[room] = [];
  CHAT_MESSAGES[room].push(msg);
  if (CHAT_MESSAGES[room].length > 200) CHAT_MESSAGES[room] = CHAT_MESSAGES[room].slice(-200);
  res.json({ ok: true, message: Object.assign({}, msg, { is_own: true }) });
});
app.get('/api/chat/online', authenticate, function(req, res) {
  const cutoff = Date.now() - 30000;
  const users = [];
  CHAT_ONLINE.forEach(function(v,k) { if (v.last_seen > cutoff) users.push({ id: k, name: v.name, role: v.role }); });
  res.json({ users: users, count: users.length });
});

// === OCR ANALYSIS ============================================================
app.post('/api/ocr/analyze', authenticate, upload.single('image'), function(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Image required' });
  const fn = (req.file.originalname || '').toLowerCase();
  const brand = fn.includes('wd')||fn.includes('western') ? 'Western Digital' : fn.includes('seagate') ? 'Seagate' : fn.includes('samsung') ? 'Samsung' : fn.includes('toshiba') ? 'Toshiba' : fn.includes('hitachi') ? 'Hitachi' : 'Unknown';
  res.json({ confidence: 0.87, raw_text: 'Model: WD10EARS Serial: WXE1E12A8123 Capacity: 1.0TB', extracted_fields: { brand: brand, model: 'WD10EARS', serial_number: 'WXE1E12A8123', capacity: '1.0 TB', form_factor: '3.5"', interface: 'SATA', rpm: '5400' }, message: 'OCR demo result. Add GOOGLE_VISION_API_KEY to .env for real OCR.' });
});

// === PROFILE PICTURE =========================================================
app.post('/api/auth/profile-picture', authenticate, upload.single('avatar'), function(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Image required' });
  if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Must be an image' });
  const b64 = 'data:' + req.file.mimetype + ';base64,' + req.file.buffer.toString('base64');
  const user = [...DEMO_USERS,...TEAM_USERS,SUPER_ADMIN].find(function(u) { return u.id === req.user.userId; });
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.avatar = b64;
  res.json({ ok: true, avatar: b64 });
});
app.delete('/api/auth/profile-picture', authenticate, function(req, res) {
  const user = [...DEMO_USERS,...TEAM_USERS,SUPER_ADMIN].find(function(u) { return u.id === req.user.userId; });
  if (user) user.avatar = null;
  res.json({ ok: true });
});

// === SEO & HOMEPAGE SETTINGS =================================================
const SEO_SETTINGS = { site_title: 'RecoverLab CRM', meta_description: 'Enterprise CRM for data recovery.', meta_keywords: 'data recovery, CRM', og_title: 'RecoverLab CRM', og_description: 'Enterprise Data Recovery Platform', og_image: '', twitter_card: 'summary_large_image', robots: 'index,follow', canonical_url: '', custom_head_scripts: '', sitemap_enabled: true, analytics_id: '', pages: [{ id: 'home', label: 'Home', path: '/', indexed: true, custom_title: '', custom_desc: '' }, { id: 'portal', label: 'Client Portal', path: '/client-portal', indexed: true, custom_title: 'Track Your Case', custom_desc: 'Check your data recovery status.' }] };
const HOMEPAGE_SETTINGS_STORE = { favicon: '', app_name: 'RecoverLab CRM', app_tagline: 'Enterprise Data Recovery Platform', hero_title: 'Professional Data Recovery Management', hero_subtitle: 'Track cases, manage clients, handle billing.', contact_phone: '+91 98765 43210', contact_email: 'support@recoverlab.in', contact_address: 'Mumbai, India', footer_text: 'c 2025 RecoverLab.', primary_color: '#00d4ff', logo_emoji: '&#x1F4BE;', logo_image: '', show_client_portal: true };
app.get('/api/settings/seo', authenticate, requireAdmin, function(req,res) { res.json(SEO_SETTINGS); });
app.patch('/api/settings/seo', authenticate, requireAdmin, function(req,res) { Object.assign(SEO_SETTINGS, req.body); res.json({ ok: true, settings: SEO_SETTINGS }); });
app.get('/api/settings/homepage', authenticate, requireAdmin, function(req,res) { res.json(HOMEPAGE_SETTINGS_STORE); });
app.patch('/api/settings/homepage', authenticate, requireAdmin, function(req,res) { Object.assign(HOMEPAGE_SETTINGS_STORE, req.body); res.json({ ok: true }); });
app.post('/api/settings/favicon', authenticate, requireAdmin, upload.single('favicon'), function(req,res) {
  if (!req.file) return res.status(400).json({ error: 'Image required' });
  HOMEPAGE_SETTINGS_STORE.favicon = 'data:' + req.file.mimetype + ';base64,' + req.file.buffer.toString('base64');
  res.json({ ok: true, favicon: HOMEPAGE_SETTINGS_STORE.favicon });
});

// === PAYMENT LINKS ===========================================================
const PAYMENT_LINKS = new Map();
app.post('/api/payments/generate-link', authenticate, function(req, res) {
  const case_id = req.body.case_id;
  const amount = req.body.amount;
  const description = req.body.description;
  const expires_in_hours = req.body.expires_in_hours || 48;
  if (!case_id || !amount) return res.status(400).json({ error: 'case_id and amount required' });
  const linkId = crypto.randomBytes(12).toString('hex');
  const link = { id: linkId, case_id: case_id, amount: parseFloat(amount), description: description || 'Payment for Case ' + case_id, status: 'pending', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + expires_in_hours * 3600000).toISOString(), paid_at: null, url: (process.env.APP_URL || 'http://localhost:5173') + '/pay/' + linkId };
  PAYMENT_LINKS.set(linkId, link);
  res.json({ ok: true, link_id: linkId, payment_url: link.url, expires_at: link.expires_at, amount: amount, description: link.description });
});
app.get('/api/payments/link/:linkId', function(req, res) {
  const link = PAYMENT_LINKS.get(req.params.linkId);
  if (!link) return res.status(404).json({ error: 'Payment link not found' });
  if (new Date(link.expires_at) < new Date()) return res.status(410).json({ error: 'Link expired' });
  res.json(link);
});
app.post('/api/payments/link/:linkId/confirm-paid', authenticate, function(req, res) {
  const link = PAYMENT_LINKS.get(req.params.linkId);
  if (!link) return res.status(404).json({ error: 'Not found' });
  if (link.status === 'paid') return res.json({ ok: true, message: 'Already paid', link: link });
  link.status = 'paid'; link.paid_at = new Date().toISOString(); link.paid_by = req.user && req.user.username;
  fireWebhookEvent('payment.received', { case_id: link.case_id, amount: link.amount });
  res.json({ ok: true, link: link });
});

// === ADVANCED WEBHOOK SYSTEM (Event-Driven, No Cronjob) ======================
const EventEmitter = require('events');
const WH_CONFIG = []; const WH_LOG = []; const WH_QUEUE = [];
const WH_EVENTS = [
  { group:'Cases', events:[{key:'case.created',label:'Case Created'},{key:'case.updated',label:'Case Updated'},{key:'case.stage_changed',label:'Stage Changed'},{key:'case.delivered',label:'Case Delivered'},{key:'case.recovered',label:'Data Recovered'},{key:'case.failed',label:'Recovery Failed'},{key:'case.deleted',label:'Sent to Recycle Bin'},{key:'case.restored',label:'Case Restored'}]},
  { group:'Payments', events:[{key:'payment.received',label:'Payment Received'},{key:'payment.link_created',label:'Payment Link Created'},{key:'invoice.created',label:'Invoice Created'},{key:'invoice.sent',label:'Invoice Sent'}]},
  { group:'Clients', events:[{key:'client.created',label:'Client Created'},{key:'client.updated',label:'Client Updated'}]},
  { group:'System', events:[{key:'user.login',label:'User Login'},{key:'user.created',label:'User Created'},{key:'backup.created',label:'Backup Created'},{key:'webhook.test',label:'Test Event'}]},
];
function fireWebhookEvent(eventKey, data) {
  const active = WH_CONFIG.filter(function(w) { return w.enabled && (w.events.includes(eventKey) || w.events.includes('*')); });
  active.forEach(function(wh) {
    const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
    const job = { id: jobId, webhook_id: wh.id, webhook_name: wh.name, event: eventKey, status: 'pending', created_at: new Date().toISOString() };
    WH_QUEUE.push(job);
    setImmediate(async function() {
      job.status = 'running'; const start = Date.now();
      try {
        const body = JSON.stringify({ event: eventKey, data: data, fired_at: new Date().toISOString() });
        const sig = crypto.createHmac('sha256', wh.secret || 'crm-secret').update(body).digest('hex');
        const r = await fetch(wh.url, { method:'POST', headers:{'Content-Type':'application/json','X-CRM-Signature':sig,'X-CRM-Event':eventKey}, body: body, signal: AbortSignal.timeout(10000) });
        job.status = r.ok ? 'completed' : 'failed'; job.response_status = r.status; job.duration_ms = Date.now()-start;
        wh.last_fired = new Date().toISOString();
        if (r.ok) wh.success_count = (wh.success_count||0)+1; else wh.fail_count = (wh.fail_count||0)+1;
      } catch(err) { job.status='failed'; job.error=err.message; job.duration_ms=Date.now()-start; wh.fail_count=(wh.fail_count||0)+1; }
      WH_LOG.unshift(Object.assign({}, job, { completed_at: new Date().toISOString() }));
      const ix = WH_QUEUE.findIndex(function(j) { return j.id === jobId; }); if (ix !== -1) WH_QUEUE.splice(ix,1);
    });
  });
}
app.get('/api/webhooks', authenticate, requireAdmin, function(req,res) { res.json({ webhooks: WH_CONFIG, events: WH_EVENTS, total: WH_CONFIG.length }); });
app.post('/api/webhooks', authenticate, requireAdmin, function(req,res) {
  const name = req.body.name; const url = req.body.url; const events = req.body.events || []; const secret = req.body.secret;
  if (!name||!url) return res.status(400).json({ error:'name and url required' });
  try { new URL(url); } catch(e) { return res.status(400).json({ error:'Invalid URL' }); }
  const wh = { id:'wh_'+Date.now(), name:name, url:url, events:events, secret: secret||crypto.randomBytes(16).toString('hex'), enabled:true, created_at: new Date().toISOString(), last_fired:null, success_count:0, fail_count:0 };
  WH_CONFIG.push(wh); res.json({ ok:true, webhook:wh });
});
app.patch('/api/webhooks/:id', authenticate, requireAdmin, function(req,res) {
  const wh = WH_CONFIG.find(function(w) { return w.id === req.params.id; });
  if (!wh) return res.status(404).json({ error:'Not found' });
  const b = req.body;
  if (b.name!==undefined) wh.name=b.name; if (b.url!==undefined) wh.url=b.url; if (b.events!==undefined) wh.events=b.events; if (b.secret!==undefined) wh.secret=b.secret; if (b.enabled!==undefined) wh.enabled=b.enabled;
  res.json({ ok:true, webhook:wh });
});
app.delete('/api/webhooks/:id', authenticate, requireAdmin, function(req,res) { const i=WH_CONFIG.findIndex(function(w){return w.id===req.params.id;}); if(i===-1) return res.status(404).json({error:'Not found'}); WH_CONFIG.splice(i,1); res.json({ok:true}); });
app.post('/api/webhooks/:id/toggle', authenticate, requireAdmin, function(req,res) { const wh=WH_CONFIG.find(function(w){return w.id===req.params.id;}); if(!wh) return res.status(404).json({error:'Not found'}); wh.enabled=!wh.enabled; res.json({ok:true,enabled:wh.enabled}); });
app.post('/api/webhooks/:id/test', authenticate, requireAdmin, async function(req,res) {
  const wh = WH_CONFIG.find(function(w){return w.id===req.params.id;});
  if (!wh) return res.status(404).json({error:'Not found'});
  const start=Date.now();
  try {
    const body=JSON.stringify({event:'webhook.test',data:{msg:'Test from RecoverLab CRM'},fired_at:new Date().toISOString()});
    const sig=crypto.createHmac('sha256',wh.secret||'test').update(body).digest('hex');
    const r=await fetch(wh.url,{method:'POST',headers:{'Content-Type':'application/json','X-CRM-Signature':sig},body:body,signal:AbortSignal.timeout(8000)});
    const duration=Date.now()-start;
    WH_LOG.unshift({id:'test_'+Date.now(),webhook_id:wh.id,event:'webhook.test',status:r.ok?'completed':'failed',response_status:r.status,duration_ms:duration,completed_at:new Date().toISOString()});
    res.json({ok:r.ok,status:r.status,duration_ms:duration,message:r.ok?'Test delivered successfully':'Server returned '+r.status});
  } catch(err) {
    WH_LOG.unshift({id:'test_'+Date.now(),webhook_id:wh.id,event:'webhook.test',status:'failed',error:err.message,duration_ms:Date.now()-start,completed_at:new Date().toISOString()});
    res.json({ok:false,error:err.message,message:'Delivery failed'});
  }
});
app.get('/api/webhooks/logs', authenticate, requireAdmin, function(req,res) {
  const webhook_id = req.query.webhook_id; const status = req.query.status; const limit = parseInt(req.query.limit||'100');
  let logs = WH_LOG;
  if (webhook_id) logs=logs.filter(function(l){return l.webhook_id===webhook_id;});
  if (status) logs=logs.filter(function(l){return l.status===status;});
  res.json({ logs:logs.slice(0,limit), queue:WH_QUEUE, stats:{total:WH_LOG.length, completed:WH_LOG.filter(function(l){return l.status==='completed';}).length, failed:WH_LOG.filter(function(l){return l.status==='failed';}).length, pending:WH_QUEUE.length} });
});
app.get('/api/integrations/events', authenticate, requireAdmin, function(req,res) { res.json({ events: WH_EVENTS }); });

`;

content = content.slice(0, insertIdx) + newCode + content.slice(insertIdx);
fs.writeFileSync(serverFile, content, 'utf8');
console.log('SUCCESS: All new endpoints injected. File lines:', content.split('\n').length);
