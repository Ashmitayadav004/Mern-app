import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientsApi } from '../services/api';
import { useAuth } from '../store/AuthContext';

function NewClientModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ country: 'India' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const client = await clientsApi.create(form);
      onCreated(client);
      onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">👥 New Client</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger" style={{marginBottom:16}}><span className="alert-icon">⚠</span> {error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label required">First Name</label>
                <input className="form-input" required value={form.first_name||''} onChange={e=>setForm({...form,first_name:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label required">Last Name</label>
                <input className="form-input" required value={form.last_name||''} onChange={e=>setForm({...form,last_name:e.target.value})} />
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label required">Phone</label>
                <input className="form-input" required value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Alternate Phone</label>
                <input className="form-input" value={form.phone_alt||''} onChange={e=>setForm({...form,phone_alt:e.target.value})} />
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Company</label>
                <input className="form-input" value={form.company||''} onChange={e=>setForm({...form,company:e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea className="form-textarea" style={{minHeight:60}} value={form.address||''} onChange={e=>setForm({...form,address:e.target.value})} />
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">City</label>
                <input className="form-input" value={form.city||''} onChange={e=>setForm({...form,city:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Referral Source</label>
                <select className="form-select" value={form.referral_source||''} onChange={e=>setForm({...form,referral_source:e.target.value})}>
                  <option value="">Select...</option>
                  <option>Walk-in</option><option>Google</option><option>Referral</option>
                  <option>Social Media</option><option>Repeat Client</option><option>Other</option>
                </select>
              </div>
            </div>
            <div style={{display:'flex',gap:20}}>
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:'0.82rem',cursor:'pointer'}}>
                <input type="checkbox" checked={form.is_corporate||false} onChange={e=>setForm({...form,is_corporate:e.target.checked})} />
                <span style={{color:'var(--text-secondary)'}}>Corporate Client</span>
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:'0.82rem',cursor:'pointer'}}>
                <input type="checkbox" checked={form.is_vip||false} onChange={e=>setForm({...form,is_vip:e.target.checked})} />
                <span style={{color:'var(--text-secondary)'}}>⭐ VIP</span>
              </label>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={loading||!form.first_name||!form.phone} onClick={handleSubmit}>
            {loading?<><div className="spinner" style={{width:14,height:14}}/> Creating...</>:'+ Add Client'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const { canAccess } = useAuth();
  const [clients, setClients] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await clientsApi.list({ page, limit: 25, search });
      setClients(d.clients || []);
      setPagination(d.pagination || {});
    } catch {} finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Client Management</h2>
          <p>CRM — {pagination.total || 0} total clients</p>
        </div>
        {canAccess('staff') && (
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Client</button>
        )}
      </div>

      <div className="filters-bar">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input className="search-input" placeholder="Search name, phone, email, company..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="table-container">
        <div style={{overflowX:'auto'}}>
          {loading ? (
            <div style={{display:'flex',justifyContent:'center',padding:60}}><div className="spinner" style={{width:28,height:28,borderWidth:3}}/></div>
          ) : (
            <table>
              <thead><tr>
                <th>Code</th><th>Name</th><th>Phone</th><th>Email</th><th>Company</th>
                <th>Active Cases</th><th>Total Paid</th><th>Tags</th><th>Joined</th>
              </tr></thead>
              <tbody>
                {clients.map(cl => (
                  <tr key={cl.id} onClick={() => navigate(`/clients/${cl.id}`)}>
                    <td><span className="font-mono text-xs text-accent">{cl.client_code}</span></td>
                    <td>
                      <div style={{fontWeight:600,fontSize:'0.85rem'}}>{cl.first_name} {cl.last_name}</div>
                    </td>
                    <td className="font-mono text-xs">{cl.phone}</td>
                    <td className="text-xs text-muted">{cl.email||'—'}</td>
                    <td className="text-xs">{cl.company||'—'}</td>
                    <td>
                      <span style={{fontFamily:'var(--font-mono)',fontWeight:700,color: cl.active_cases>0?'var(--accent-primary)':'var(--text-muted)'}}>
                        {cl.active_cases||0}
                      </span>
                    </td>
                    <td className="font-mono text-xs">₹{parseFloat(cl.total_paid||0).toLocaleString('en-IN')}</td>
                    <td>
                      <div style={{display:'flex',gap:4}}>
                        {cl.is_vip && <span style={{fontSize:'0.65rem',padding:'2px 6px',background:'rgba(245,158,11,0.15)',borderRadius:999,color:'#fbbf24',fontFamily:'var(--font-mono)'}}>⭐ VIP</span>}
                        {cl.is_corporate && <span style={{fontSize:'0.65rem',padding:'2px 6px',background:'rgba(59,130,246,0.15)',borderRadius:999,color:'#60a5fa',fontFamily:'var(--font-mono)'}}>🏢 Corp</span>}
                      </div>
                    </td>
                    <td className="text-xs text-muted">{new Date(cl.created_at).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
                {!clients.length && (
                  <tr><td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-icon">👥</div>
                      <div className="empty-title">No clients found</div>
                      <div className="empty-desc">Add your first client to get started</div>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        {pagination.pages > 1 && (
          <div style={{display:'flex',justifyContent:'center',gap:12,padding:16,borderTop:'1px solid var(--border-subtle)'}}>
            <button className="btn btn-secondary btn-sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
            <span className="text-xs text-muted font-mono">Page {page} of {pagination.pages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page>=pagination.pages} onClick={()=>setPage(p=>p+1)}>Next →</button>
          </div>
        )}
      </div>

      {showNew && <NewClientModal onClose={()=>setShowNew(false)} onCreated={load} />}
    </div>
  );
}
