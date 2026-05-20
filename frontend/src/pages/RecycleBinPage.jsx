import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

const BASE_URL = '/api';
const getToken = () => localStorage.getItem('accessToken');

const binApi = {
  list: () => fetch(`${BASE_URL}/recycle-bin`, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()),
  restore: (id, password) => fetch(`${BASE_URL}/recycle-bin/${id}/restore`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_password: password }),
  }).then(r => r.json()),
  permanentDelete: (id, password) => fetch(`${BASE_URL}/recycle-bin/${id}/permanent-delete`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_password: password }),
  }).then(r => r.json()),
};

const daysAgo = (d) => {
  const diff = Math.floor((Date.now() - new Date(d)) / 86400000);
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : `${diff} days ago`;
};

function PasswordModal({ item, onConfirm, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) { setError('Password is required'); return; }
    // Verify against stored recycle bin password
    const companyData = (() => { try { return JSON.parse(localStorage.getItem('crm_company')) || {}; } catch { return {}; }})();
    const storedPassword = companyData.recycle_bin_password;
    if (storedPassword && password !== storedPassword) {
      setError('Incorrect Recycle Bin password');
      return;
    }
    setLoading(true);
    try {
      await onConfirm(item.id, password);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3 className="modal-title">🔐 Recycle Bin Password Required</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            Enter the Recycle Bin password to restore <strong>{item.case_number}</strong>.
            This password is different from your login password and is set in Settings → Recycle Bin.
          </p>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><span className="alert-icon">⚠</span> {error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label required">Recycle Bin Password</label>
              <input type="password" className="form-input" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} autoFocus placeholder="Enter recycle bin password" />
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={loading || !password} onClick={handleSubmit}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Restoring...</> : '↩ Restore Case'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PermanentDeleteModal({ item, onConfirm, onClose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    if (confirm !== item.case_number) { setError(`Type "${item.case_number}" to confirm`); return; }
    if (!password) { setError('Admin password required'); return; }
    setLoading(true);
    try { await onConfirm(item.id, password); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, border: '1px solid rgba(239,68,68,0.4)' }}>
        <div className="modal-header" style={{ background: 'rgba(239,68,68,0.08)' }}>
          <h3 className="modal-title" style={{ color: 'var(--status-danger)' }}>⚠️ Permanent Delete — {item.case_number}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>
            <span className="alert-icon">🗑️</span>
            <div><strong>This action cannot be undone.</strong> The case and all related data (files, payments, timeline, solution) will be permanently destroyed.</div>
          </div>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}><span className="alert-icon">⚠</span> {error}</div>}
          <form onSubmit={handle}>
            <div className="form-group">
              <label className="form-label required">Type case number to confirm: <code style={{ color: 'var(--status-danger)', background: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: 4 }}>{item.case_number}</code></label>
              <input className="form-input" value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }} placeholder={item.case_number} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label required">Super Admin Password</label>
              <input type="password" className="form-input" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} placeholder="Your admin account password" />
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" disabled={loading || confirm !== item.case_number || !password} onClick={handle}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Deleting...</> : '🗑️ Permanently Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecycleBinPage() {
  const { canAccess, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const isSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await binApi.list(); setItems(d.items || []); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRestore = async (id, password) => {
    const result = await binApi.restore(id, password);
    if (result.error) throw new Error(result.error);
    setRestoreTarget(null);
    load();
    alert('✅ Case restored successfully.');
  };

  const handlePermanentDelete = async (id, password) => {
    const result = await binApi.permanentDelete(id, password);
    if (result.error) throw new Error(result.error);
    setDeleteTarget(null);
    load();
    alert('🗑️ Case permanently deleted.');
  };

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24 }}>
        <div>
          <h2 style={{ marginBottom:4 }}>🗑️ Recycle Bin</h2>
          <p style={{ color:'var(--text-muted)',fontSize:'0.82rem' }}>Soft-deleted cases — restore only. Permanent deletion is disabled for data safety.</p>
        </div>
      </div>

      <div style={{ padding:'10px 16px',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:'var(--radius-md)',marginBottom:16,display:'flex',alignItems:'center',gap:10,fontSize:'0.8rem',color:'var(--status-warning)' }}>
        <span>⚠️</span>
        <span>Items in the Recycle Bin will remain here indefinitely until restored. Restore requires the Recycle Bin password (set in Settings). <strong>Permanent deletion</strong> is available to Admins and Super Admins only.</span>
      </div>

      {loading ? (
        <div style={{ display:'flex',justifyContent:'center',padding:60 }}><div className="spinner" style={{ width:32,height:32 }} /></div>
      ) : items.length === 0 ? (
        <div className="empty-state" style={{ padding:80 }}>
          <div className="empty-icon">🗑️</div>
          <div className="empty-title">Recycle Bin is Empty</div>
          <div className="empty-desc">Deleted cases will appear here and can be restored using the Recycle Bin password.</div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Case #</th><th>Client</th><th>Device</th><th>Status at Deletion</th><th>Deleted By</th><th>Deleted</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ opacity:0.85 }}>
                  <td><span className="font-mono text-xs" style={{ color:'var(--text-muted)' }}>{item.case_number}</span></td>
                  <td><div style={{ fontWeight:600 }}>{item.client_name}</div></td>
                  <td className="text-xs">{[item.device_type,item.brand,item.model].filter(Boolean).join(' · ')}</td>
                  <td><span style={{ fontSize:'0.68rem',padding:'2px 7px',borderRadius:999,background:'rgba(100,116,139,0.12)',color:'#94a3b8',fontFamily:'var(--font-mono)' }}>{item.status}</span></td>
                  <td className="text-xs text-muted">{item.deleted_by||'Admin'}</td>
                  <td className="text-xs text-muted">{daysAgo(item.deleted_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setRestoreTarget(item)}>🔐 Restore</button>
                      {isSuperAdmin && <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(item)} style={{ fontSize: '0.72rem' }}>🗑 Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginTop:24,border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.02)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:12 }}>
          <span style={{ fontSize:'1.5rem' }}>🔒</span>
          <div>
            <div style={{ fontWeight:700,fontSize:'0.85rem',color:'var(--status-danger)',marginBottom:4 }}>Permanent Deletion Policy</div>
            <div style={{ fontSize:'0.78rem',color:'var(--text-muted)',lineHeight:1.6 }}>
              Permanent deletion is available to <strong>Admin</strong> and <strong>Super Admin</strong> accounts only.
              This action cannot be undone — the case number must be typed to confirm.
              This policy ensures audit trails and prevents accidental data loss.
            </div>
          </div>
        </div>
      </div>

      {restoreTarget && (
        <PasswordModal item={restoreTarget} onConfirm={handleRestore} onClose={() => setRestoreTarget(null)} />
      )}
      {deleteTarget && (
        <PermanentDeleteModal item={deleteTarget} onConfirm={handlePermanentDelete} onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
