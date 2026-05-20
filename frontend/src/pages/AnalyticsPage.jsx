import React, { useState, useEffect } from 'react';
import { analyticsApi } from '../services/api';

function MiniBarChart({ data, labelKey, valueKey, color = 'var(--accent-primary)' }) {
  if (!data?.length) return <div className="empty-state" style={{ padding: 30 }}><div className="empty-desc">No data yet</div></div>;
  const max = Math.max(...data.map(d => parseFloat(d[valueKey]) || 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 100, fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d[labelKey]}
          </div>
          <div style={{ flex: 1, height: 8, background: 'var(--border-subtle)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${max > 0 ? (parseFloat(d[valueKey]) / max) * 100 : 0}%`, background: color, borderRadius: 999, transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ width: 50, fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', flexShrink: 0 }}>
            {parseFloat(d[valueKey]).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
      ))}
    </div>
  );
}

function RevenueChart({ data }) {
  if (!data?.length) return <div className="empty-state" style={{ padding: 30 }}><div className="empty-desc">No revenue data yet</div></div>;
  const max = Math.max(...data.map(d => parseFloat(d.revenue) || 0));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, paddingTop: 10 }}>
      {data.map((d, i) => {
        const height = max > 0 ? (parseFloat(d.revenue) / max) * 120 : 0;
        const month = new Date(d.month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
              ₹{(parseFloat(d.revenue) / 1000).toFixed(0)}k
            </div>
            <div style={{ width: '100%', height: Math.max(height, 3), background: i === data.length - 1 ? 'var(--accent-primary)' : 'rgba(0,212,255,0.3)', borderRadius: '3px 3px 0 0', transition: 'height 0.8s ease', position: 'relative' }}
              title={`₹${parseFloat(d.revenue).toLocaleString('en-IN')}`} />
            <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
              {month}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const [dashboard, setDashboard] = useState(null);
  const [modelFailures, setModelFailures] = useState([]);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.dashboard(),
      analyticsApi.modelFailures(),
      analyticsApi.revenueTrend(),
    ]).then(([dash, models, rev]) => {
      setDashboard(dash);
      setModelFailures(models);
      setRevenueTrend(rev);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
    </div>
  );

  const c = dashboard?.cases || {};
  const r = dashboard?.revenue || {};

  const kpis = [
    { label: 'Total Active', value: c.active || 0, icon: '📂', color: 'var(--accent-primary)', bg: 'rgba(0,212,255,0.1)' },
    { label: 'Completed All-Time', value: c.completed || 0, icon: '✅', color: 'var(--status-success)', bg: 'rgba(16,185,129,0.1)' },
    { label: 'Failed Cases', value: c.failed || 0, icon: '💔', color: 'var(--status-danger)', bg: 'rgba(239,68,68,0.1)' },
    { label: 'This Month', value: c.this_month || 0, icon: '📅', color: 'var(--accent-secondary)', bg: 'rgba(124,58,237,0.1)' },
    { label: 'Revenue (Month)', value: `₹${parseFloat(r.revenue_month || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: '💰', color: 'var(--status-warning)', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Total Revenue', value: `₹${parseFloat(r.total_revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: '🏦', color: 'var(--status-success)', bg: 'rgba(16,185,129,0.1)' },
  ];

  // Process failure data by type
  const failureByType = {};
  (dashboard?.failureAnalytics || []).forEach(f => {
    const key = f.failure_type || 'unknown';
    failureByType[key] = (failureByType[key] || 0) + parseInt(f.count);
  });

  const failureByBrand = {};
  (dashboard?.failureAnalytics || []).forEach(f => {
    const key = f.device_brand || 'Unknown';
    failureByBrand[key] = (failureByBrand[key] || 0) + parseInt(f.count);
  });

  const failureTypeData = Object.entries(failureByType).map(([k, v]) => ({ label: k, count: v })).sort((a, b) => b.count - a.count);
  const failureBrandData = Object.entries(failureByBrand).map(([k, v]) => ({ label: k, count: v })).sort((a, b) => b.count - a.count).slice(0, 8);

  // Success rate
  const successRate = c.completed && c.total ? Math.round((parseInt(c.completed) / parseInt(c.total)) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Analytics & Intelligence Reports</h2>
          <p>Recovery performance, failure patterns, and revenue insights</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        {kpis.map(k => (
          <div key={k.label} className="stat-card" style={{ '--stat-color': k.color, '--stat-bg': k.bg }}>
            <div className="stat-icon">{k.icon}</div>
            <div className="stat-value" style={{ fontSize: '1.4rem' }}>{k.value}</div>
            <div className="stat-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Success Rate Banner */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ textAlign: 'center', minWidth: 100 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', fontWeight: 900, color: successRate >= 80 ? 'var(--status-success)' : successRate >= 60 ? 'var(--status-warning)' : 'var(--status-danger)', lineHeight: 1 }}>
            {successRate}%
          </div>
          <div className="stat-label" style={{ marginTop: 4 }}>Overall Recovery Rate</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 6 }}>
            <span className="text-muted">Lifetime Performance</span>
            <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{c.completed || 0} of {c.total || 0} cases</span>
          </div>
          <div className="progress-bar" style={{ height: 14, borderRadius: 7 }}>
            <div className="progress-fill" style={{ width: `${successRate}%`, borderRadius: 7 }} />
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
            {[
              { label: 'Active', val: c.active || 0, col: 'var(--accent-primary)' },
              { label: 'Completed', val: c.completed || 0, col: 'var(--status-success)' },
              { label: 'Failed', val: c.failed || 0, col: 'var(--status-danger)' },
              { label: 'Critical', val: c.critical || 0, col: 'var(--risk-critical)' },
            ].map(({ label, val, col }) => (
              <div key={label}>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1rem', color: col }}>{val}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Revenue Trend */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">💰 Revenue Trend (12 Months)</div>
          </div>
          <RevenueChart data={revenueTrend} />
          {revenueTrend.length > 0 && (
            <div style={{ marginTop: 12, padding: '8px 0', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 20, fontSize: '0.75rem' }}>
              <span className="text-muted">Total: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>₹{revenueTrend.reduce((s, d) => s + parseFloat(d.revenue || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></span>
              <span className="text-muted">Avg/month: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>₹{(revenueTrend.reduce((s, d) => s + parseFloat(d.revenue || 0), 0) / revenueTrend.length).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></span>
            </div>
          )}
        </div>

        {/* Failure by Type */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">🔬 Failure Type Distribution</div>
          </div>
          {failureTypeData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {failureTypeData.map((f, i) => {
                const total = failureTypeData.reduce((s, x) => s + x.count, 0);
                const pct = Math.round((f.count / total) * 100);
                const colors = { logical: '#3b82f6', firmware: '#6366f1', electrical: '#f59e0b', mechanical: '#ef4444', unknown: '#64748b' };
                return (
                  <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`badge badge-${f.label}`} style={{ minWidth: 90 }}>{f.label}</span>
                    <div style={{ flex: 1, height: 10, background: 'var(--border-subtle)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: colors[f.label] || 'var(--accent-primary)', borderRadius: 999, transition: 'width 0.8s ease' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, minWidth: 70, justifyContent: 'flex-end' }}>
                      <span className="font-mono text-xs" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{f.count}</span>
                      <span className="text-xs text-muted">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <div className="empty-state" style={{ padding: 30 }}><div className="empty-desc">No failure data yet</div></div>}
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Brand-wise */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">🏷️ Cases by Brand</div>
          </div>
          <MiniBarChart data={failureBrandData} labelKey="label" valueKey="count" color="linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))" />
        </div>

        {/* Engineer Performance */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">⚡ Engineer Leaderboard</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(dashboard?.engineers || []).slice(0, 6).map((eng, i) => (
              <div key={eng.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: i < 3 ? 'rgba(245,158,11,0.15)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: i < 3 ? '#fbbf24' : 'var(--text-muted)', flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div className="user-avatar" style={{ width: 30, height: 30, fontSize: '0.65rem', flexShrink: 0 }}>
                  {eng.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eng.full_name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{eng.role?.replace('_', ' ')}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-primary)' }}>{eng.completed_cases}</div>
                  <div style={{ fontSize: '0.65rem', color: eng.success_rate >= 80 ? 'var(--status-success)' : 'var(--status-warning)', fontFamily: 'var(--font-mono)' }}>
                    {eng.success_rate ? `${eng.success_rate}%` : '—'} success
                  </div>
                </div>
              </div>
            ))}
            {!dashboard?.engineers?.length && (
              <div className="empty-state" style={{ padding: 24 }}><div className="empty-desc">No engineer data</div></div>
            )}
          </div>
        </div>
      </div>

      {/* Model Failure Analytics */}
      {modelFailures.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">💿 Model-Level Recovery Analytics</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Brand</th><th>Model</th><th>Total Cases</th><th>Recovered</th>
                  <th>Failed</th><th>Recovery Rate</th><th>Common Failure</th>
                </tr>
              </thead>
              <tbody>
                {modelFailures.slice(0, 15).map((m, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{m.brand}</td>
                    <td><span className="font-mono text-xs text-accent">{m.model_number}</span></td>
                    <td className="font-mono text-xs">{m.total_cases}</td>
                    <td style={{ color: 'var(--status-success)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{m.recovered}</td>
                    <td style={{ color: 'var(--status-danger)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{m.failed}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 60, height: 4, background: 'var(--border-subtle)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${m.recovery_rate || 0}%`, background: m.recovery_rate >= 80 ? 'var(--status-success)' : m.recovery_rate >= 50 ? 'var(--status-warning)' : 'var(--status-danger)', borderRadius: 999 }} />
                        </div>
                        <span className="font-mono text-xs" style={{ fontWeight: 800, color: m.recovery_rate >= 80 ? 'var(--status-success)' : m.recovery_rate >= 50 ? 'var(--status-warning)' : 'var(--status-danger)' }}>
                          {m.recovery_rate}%
                        </span>
                      </div>
                    </td>
                    <td>{m.common_failure && <span className={`badge badge-${m.common_failure}`}>{m.common_failure}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
