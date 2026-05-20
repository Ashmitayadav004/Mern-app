import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../store/AuthContext';

const BASE_URL = '/api';
const getToken = () => localStorage.getItem('accessToken');

// In-memory solutions store (talks to demo-server)
const solApi = {
  list: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(`${BASE_URL}/solutions${qs ? '?' + qs : ''}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    return r.json();
  },
  create: async (formData) => {
    const r = await fetch(`${BASE_URL}/solutions`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: formData });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
    return r.json();
  },
  delete: async (id) => {
    await fetch(`${BASE_URL}/solutions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
  },
};

const DEVICE_TYPES = ['HDD', 'SSD', 'Phone', 'PCB', 'NAS', 'Server', 'Flash Drive', 'RAID', 'Other'];
const PROB_TAGS = ['Head Crash', 'Firmware Corruption', 'Logical Error', 'PCB Damage', 'BSY Error', 'Bad Sectors', 'Motor Seized', 'Not Detected', 'Water Damage', 'Fire Damage', 'Encrypted', 'RAID Rebuild', 'Deleted Files'];
const TYPE_ICONS = { HDD: '💿', SSD: '⚡', Phone: '📱', PCB: '🔌', NAS: '🖥️', Server: '🖧', 'Flash Drive': '🔌', RAID: '🗃️', Other: '🔧' };

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── New Solution Modal ──────────────────────────────────────────
function NewSolutionModal({ onClose, onDone }) {
  const [form, setForm] = useState({ title: '', company: '', device_type: 'HDD', problem: '', notes: '', tags: [] });
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef();

  const handleFiles = (newFiles) => {
    setFiles(prev => [...prev, ...Array.from(newFiles).map(f => ({ file: f, id: `f_${Date.now()}_${Math.random()}` }))]);
  };

  const toggleTag = (tag) => setForm(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }));

  const handle = async () => {
    if (!form.title || !form.device_type) return;
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, Array.isArray(v) ? JSON.stringify(v) : v));
      files.forEach(({ file }) => fd.append('files', file));
      await solApi.create(fd);
      onDone();
      onClose();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📚 Add Solution / Knowledge Entry</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label required">Solution Title</label>
              <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. WD Head Swap — BSY Fix Procedure" />
            </div>
            <div className="form-group">
              <label className="form-label">Company / Client (optional)</label>
              <input className="form-input" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Client or company this applies to" />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label required">Device Type</label>
              <select className="form-select" value={form.device_type} onChange={e => setForm({ ...form, device_type: e.target.value })}>
                {DEVICE_TYPES.map(d => <option key={d} value={d}>{TYPE_ICONS[d]} {d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Problem Summary</label>
              <input className="form-input" value={form.problem} onChange={e => setForm({ ...form, problem: e.target.value })} placeholder="Short problem description" />
            </div>
          </div>

          {/* Tags */}
          <div className="form-group">
            <label className="form-label">Problem Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PROB_TAGS.map(tag => (
                <button key={tag} type="button" onClick={() => toggleTag(tag)}
                  style={{ padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', cursor: 'pointer', border: `1px solid ${form.tags.includes(tag) ? 'var(--accent-primary)' : 'var(--border-default)'}`, background: form.tags.includes(tag) ? 'rgba(0,212,255,0.12)' : 'var(--bg-elevated)', color: form.tags.includes(tag) ? 'var(--accent-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Detailed Notes / Steps</label>
            <textarea className="form-textarea" style={{ minHeight: 140, fontFamily: 'var(--font-sans)', lineHeight: 1.7 }}
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Step-by-step recovery procedure, tools used, settings, pitfalls to avoid..." />
          </div>

          {/* File upload */}
          <div className="form-group">
            <label className="form-label">Attachments (PDF, images, logs, videos)</label>
            <div style={{ border: `2px dashed ${dragging ? 'var(--accent-primary)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'rgba(0,212,255,0.04)' : 'var(--bg-elevated)', transition: 'all 0.15s' }}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => inputRef.current?.click()}>
              <input ref={inputRef} type="file" multiple accept="image/*,video/*,application/pdf,.txt,.log" style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
              <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>📎</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Drop files or click to browse</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>PDF, images, videos, log files</div>
            </div>
            {files.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {files.map(({ file, id }) => (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '1rem' }}>{file.type.startsWith('image/') ? '🖼️' : file.type === 'application/pdf' ? '📄' : file.type.startsWith('video/') ? '🎬' : '📎'}</span>
                    <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{formatSize(file.size)}</span>
                    <button onClick={() => setFiles(prev => prev.filter(f => f.id !== id))} style={{ background: 'none', border: 'none', color: 'var(--status-danger)', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={loading || !form.title} onClick={handle}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : '📚 Save Solution'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Solution Detail Modal ───────────────────────────────────────
function SolutionDetailModal({ sol, onClose, onDelete, canDelete }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{TYPE_ICONS[sol.device_type]} {sol.title}</h3>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {sol.device_type} • {sol.company || 'General'} • {new Date(sol.created_at).toLocaleDateString('en-IN')}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {sol.problem && (
            <div style={{ padding: '10px 14px', background: 'rgba(0,212,255,0.05)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-accent)', marginBottom: 16 }}>
              <div className="tech-data-label" style={{ marginBottom: 4 }}>Problem</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{sol.problem}</div>
            </div>
          )}

          {sol.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {sol.tags.map(t => <span key={t} style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.68rem', background: 'rgba(124,58,237,0.12)', color: '#a78bfa', fontFamily: 'var(--font-mono)' }}>{t}</span>)}
            </div>
          )}

          {sol.notes && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 10 }}>📝 Recovery Notes & Procedure</div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>{sol.notes}</pre>
            </div>
          )}

          {sol.files?.length > 0 && (
            <div>
              <div className="card-title" style={{ marginBottom: 12 }}>📎 Attachments ({sol.files.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
                {sol.files.map((f, i) => {
                  const isImg = f.mimeType?.startsWith('image/');
                  const isVid = f.mimeType?.startsWith('video/');
                  const isPDF = f.mimeType === 'application/pdf';
                  return (
                    <div key={i} style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-elevated)', cursor: 'pointer' }}
                      onClick={() => { const a = document.createElement('a'); a.href = f.data; a.download = f.name; a.click(); }}>
                      {isImg ? (
                        <img src={f.data} alt={f.name} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
                          {isVid ? '🎬' : isPDF ? '📄' : '📎'}
                        </div>
                      )}
                      <div style={{ padding: '6px 10px' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{formatSize(f.size)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {canDelete && <button className="btn btn-danger" onClick={() => { if (confirm('Delete this solution?')) { onDelete(sol.id); onClose(); } }}>🗑 Delete</button>}
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export default function SolutionsPage() {
  const { canAccess } = useAuth();
  const [solutions, setSolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await solApi.list({ search, device_type: deviceFilter, tag: tagFilter });
      setSolutions(data.solutions || []);
    } catch { } finally { setLoading(false); }
  }, [search, deviceFilter, tagFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    try { await solApi.delete(id); load(); } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Knowledge Base</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Recovery solutions, procedures, and technical documentation</p>
        </div>
        {canAccess('junior_engineer') && (
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Add Solution</button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-icon">🔍</span>
          <input className="search-input" placeholder="Search solutions by title, problem, notes…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={deviceFilter} onChange={e => setDeviceFilter(e.target.value)}>
          <option value="">All Devices</option>
          {DEVICE_TYPES.map(d => <option key={d} value={d}>{TYPE_ICONS[d]} {d}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
          <option value="">All Tags</option>
          {PROB_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {['HDD', 'SSD', 'Phone', 'PCB'].map(type => {
          const count = solutions.filter(s => s.device_type === type).length;
          return (
            <button key={type} onClick={() => setDeviceFilter(deviceFilter === type ? '' : type)}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', border: `1px solid ${deviceFilter === type ? 'var(--accent-primary)' : 'var(--border-default)'}`, background: deviceFilter === type ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: deviceFilter === type ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
              {TYPE_ICONS[type]} {type} ({count})
            </button>
          );
        })}
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center' }}>{solutions.length} solution(s)</span>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      ) : solutions.length === 0 ? (
        <div className="empty-state" style={{ padding: 60 }}>
          <div className="empty-icon">📚</div>
          <div className="empty-title">No solutions found</div>
          <div className="empty-desc">Build your knowledge base by documenting recovery procedures</div>
          {canAccess('junior_engineer') && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowNew(true)}>+ Add First Solution</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {solutions.map(sol => (
            <div key={sol.id} className="card" style={{ cursor: 'pointer', transition: 'all 0.15s' }}
              onClick={() => setSelected(sol)}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = ''}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{ fontSize: '1.5rem' }}>{TYPE_ICONS[sol.device_type] || '🔧'}</span>
                <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 999, background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{sol.device_type}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.4 }}>{sol.title}</div>
              {sol.problem && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{sol.problem}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                {(sol.tags || []).slice(0, 3).map(t => <span key={t} style={{ padding: '2px 6px', borderRadius: 999, fontSize: '0.62rem', background: 'rgba(124,58,237,0.1)', color: '#a78bfa', fontFamily: 'var(--font-mono)' }}>{t}</span>)}
                {sol.tags?.length > 3 && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>+{sol.tags.length - 3} more</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <span>{sol.company || 'General'}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {sol.files?.length > 0 && <span>📎 {sol.files.length}</span>}
                  <span>{new Date(sol.created_at).toLocaleDateString('en-IN')}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && <NewSolutionModal onClose={() => setShowNew(false)} onDone={load} />}
      {selected && <SolutionDetailModal sol={selected} onClose={() => setSelected(null)} onDelete={handleDelete} canDelete={canAccess('admin')} />}
    </div>
  );
}
