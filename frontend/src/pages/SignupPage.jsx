import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MathCaptcha from '../components/MathCaptcha';

const API = '/api';

const PLANS = [
  { key: 'starter',      label: 'Starter',      price: 999,  trial: true, maxUsers: 2,  color: '#64748b', features: ['2 team users', 'Basic reports', '5GB storage'] },
  { key: 'professional', label: 'Professional', price: 2499, trial: true, maxUsers: 5,  color: '#3b82f6', features: ['5 team users', 'Advanced reports', '20GB storage', 'WhatsApp integration'] },
  { key: 'business',     label: 'Business',     price: 4999, trial: true, maxUsers: 15, color: '#8b5cf6', features: ['15 team users', 'Full analytics', '100GB storage', 'API access', 'Priority support'] },
];

export default function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: plan, 2: details, 3: done
  const [plan, setPlan] = useState('starter');
  const [form, setForm] = useState({ company_name: '', admin_name: '', admin_email: '', admin_password: '', confirm_password: '', phone: '', city: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [captchaOk, setCaptchaOk] = useState(false);
  const [captchaReset, setCaptchaReset] = useState(0);

  const selPlan = PLANS.find(p => p.key === plan) || PLANS[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!captchaOk) { setError('Please solve the verification CAPTCHA.'); setCaptchaReset(r => r + 1); return; }
    if (form.admin_password !== form.confirm_password) { setError('Passwords do not match'); return; }
    if (form.admin_password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      setResult(data);
      setStep(3);
    } catch (err) {
      setError(err.message);
      setCaptchaOk(false);
      setCaptchaReset(r => r + 1);
    } finally {
      setLoading(false);
    }
  };

  const pwStrength = (pw) => [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^a-zA-Z0-9]/.test(pw)];

  return (
    <div className="login-page">
      <div className="login-bg-grid" />
      <div className="login-bg-glow" />

      <div className="login-card" style={{ maxWidth: step === 1 ? 640 : 480, transition: 'max-width 0.3s ease' }}>
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">💾</div>
          <div className="login-app-name">RecoverLab CRM</div>
          <div className="login-tagline">
            {step === 1 ? 'Choose your plan — 14-day free trial' : step === 2 ? 'Create your account' : 'Account created!'}
          </div>
        </div>

        {/* Progress */}
        {step < 3 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
            {['Plan', 'Details', 'Done'].map((s, i) => (
              <React.Fragment key={s}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: step > i + 1 ? '#10b981' : step === i + 1 ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                    border: `2px solid ${step >= i + 1 ? (step > i + 1 ? '#10b981' : 'var(--accent-primary)') : 'var(--border-default)'}`,
                    color: step >= i + 1 ? '#fff' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800, transition: 'all 0.2s',
                  }}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: '0.62rem', marginTop: 4, color: step === i + 1 ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: step === i + 1 ? 700 : 400 }}>{s}</div>
                </div>
                {i < 2 && <div style={{ flex: 2, height: 2, background: step > i + 1 ? '#10b981' : 'var(--border-subtle)', marginBottom: 18, transition: 'all 0.2s' }} />}
              </React.Fragment>
            ))}
          </div>
        )}

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>
            <span className="alert-icon">⚠</span><div>{error}</div>
          </div>
        )}

        {/* ── STEP 1: Plan Selection ── */}
        {step === 1 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              {PLANS.map(p => (
                <div key={p.key} onClick={() => setPlan(p.key)} style={{
                  padding: '14px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.15s',
                  border: `2px solid ${plan === p.key ? p.color : 'var(--border-subtle)'}`,
                  background: plan === p.key ? `${p.color}10` : 'var(--bg-elevated)',
                  position: 'relative',
                }}>
                  {plan === p.key && (
                    <div style={{ position: 'absolute', top: -8, right: 8, background: p.color, color: '#fff', fontSize: '0.55rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>SELECTED</div>
                  )}
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: p.color, marginBottom: 4 }}>{p.label}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    ₹{p.price.toLocaleString('en-IN')}<span style={{ fontSize: '0.6rem', fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 10 }}>{p.maxUsers} users</div>
                  {p.features.map(f => (
                    <div key={f} style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', marginBottom: 2, display: 'flex', gap: 5 }}>
                      <span style={{ color: p.color, flexShrink: 0 }}>✓</span>{f}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)', marginBottom: 20, fontSize: '0.78rem', color: '#10b981', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: '1.1rem' }}>🎁</span>
              <div><strong>14-day free trial</strong> on all plans — no credit card required to start. Upgrade anytime.</div>
            </div>

            <button className="btn btn-primary w-full btn-lg" onClick={() => setStep(2)}>
              Continue with {selPlan.label} →
            </button>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <Link to="/login" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
                Already have an account? <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Sign in</span>
              </Link>
            </div>
          </div>
        )}

        {/* ── STEP 2: Account Details ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '8px 12px', background: `${selPlan.color}10`, border: `1px solid ${selPlan.color}30`, borderRadius: 'var(--radius-md)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem' }}>
              <span style={{ fontWeight: 700, color: selPlan.color }}>💎 {selPlan.label} Plan</span>
              <span style={{ color: 'var(--text-muted)' }}>·</span>
              <span style={{ color: 'var(--text-muted)' }}>₹{selPlan.price.toLocaleString('en-IN')}/mo after 14-day trial</span>
              <button type="button" onClick={() => setStep(1)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.7rem' }}>Change</button>
            </div>

            <div className="form-group">
              <label className="form-label required">Company / Lab Name</label>
              <input className="form-input" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="e.g. DataRescue Mumbai" required autoFocus />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label required">Your Name</label>
                <input className="form-input" value={form.admin_name} onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))} placeholder="Full name" required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label required">Work Email (login ID)</label>
              <input type="email" className="form-input" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} placeholder="admin@yourlab.com" required />
            </div>
            <div className="form-group">
              <label className="form-label required">Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} className="form-input" value={form.admin_password}
                  onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))}
                  placeholder="Min 8 chars" required style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)' }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
              {form.admin_password && (
                <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                  {['Length ≥8', 'Uppercase', 'Number', 'Symbol'].map((req, i) => {
                    const ok = pwStrength(form.admin_password)[i];
                    return <div key={req} style={{ flex: 1, height: 3, borderRadius: 2, background: ok ? '#22c55e' : 'var(--border-default)', transition: 'background 0.2s' }} title={req} />;
                  })}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label required">Confirm Password</label>
              <input type="password" className="form-input" value={form.confirm_password}
                onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                placeholder="Repeat password" required />
              {form.confirm_password && form.admin_password !== form.confirm_password && (
                <div style={{ fontSize: '0.68rem', color: 'var(--status-danger)', marginTop: 4 }}>Passwords do not match</div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Mumbai" />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ marginBottom: 8 }}>Verification <span style={{ color: 'var(--status-danger)' }}>*</span></label>
              <MathCaptcha onVerify={setCaptchaOk} resetKey={captchaReset} />
            </div>

            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
              By creating an account you agree to our <span style={{ color: 'var(--accent-primary)' }}>Terms of Service</span> and <span style={{ color: 'var(--accent-primary)' }}>Privacy Policy</span>.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setStep(1); setError(''); }}>← Back</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !captchaOk || form.admin_password !== form.confirm_password}>
                {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Creating account...</> : '🚀 Create Free Account'}
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 3: Done ── */}
        {step === 3 && result && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8, color: 'var(--text-primary)' }}>
              Welcome to RecoverLab CRM!
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              Your account has been created. You have a <strong>14-day free trial</strong> on the <strong>{selPlan.label}</strong> plan.
            </div>

            <div style={{ padding: '14px 16px', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 'var(--radius-md)', marginBottom: 20, textAlign: 'left' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your Login Details</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Email</span>
                <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 700 }}>{form.admin_email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Plan</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: selPlan.color }}>{selPlan.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Trial ends</span>
                <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>{new Date(Date.now() + 14 * 86400000).toLocaleDateString('en-IN')}</span>
              </div>
            </div>

            <button className="btn btn-primary w-full btn-lg" onClick={() => navigate('/login')}>
              → Sign In to Your Account
            </button>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 12 }}>
              After sign-in, go to <strong>Settings → Razorpay</strong> to activate payments.
            </div>
          </div>
        )}

        {step < 3 && (
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span>🔒</span> All data encrypted · SOC2 compliant · 99.9% uptime
          </div>
        )}
      </div>
    </div>
  );
}
