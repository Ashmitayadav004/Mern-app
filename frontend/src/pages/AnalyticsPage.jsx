import React, { useState, useEffect } from 'react';
import { analyticsApi } from '../services/api';
import { RevenueTrendChart, FailureTypeChart, BrandDistributionChart, CaseStatusChart, StageDistributionChart } from '../components/Charts';

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
    { label: 'Total Active Cases', value: c.active || 0, color: 'var(--accent-primary)', bg: 'rgba(0,212,255,0.1)' },
    { label: 'Completed cases', value: c.completed || 0, color: 'var(--status-success)', bg: 'rgba(16,185,129,0.1)' },
    { label: 'Failed Cases', value: c.failed || 0, color: 'var(--status-danger)', bg: 'rgba(239,68,68,0.1)' },
    { label: 'This Month Cases', value: c.this_month || 0, color: 'var(--accent-secondary)', bg: 'rgba(124,58,237,0.1)' },
    { label: 'Revenue (Month)', value: `₹${parseFloat(r.revenue_month || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'var(--status-warning)', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Total Revenue', value: `₹${parseFloat(r.total_revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'var(--status-success)', bg: 'rgba(16,185,129,0.1)' },
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
      <div className="stats-grid analytics-kpi-grid" style={{ marginBottom: 28 }}>
        {kpis.map(k => (
          <div key={k.label} className="stat-card" style={{ '--stat-color': k.color, '--stat-bg': k.bg }}>
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

      {/* Stage Distribution Chart */}
      {dashboard?.stageDistribution?.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Case Stage Distribution</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'center' }}>
            <div style={{ position: 'relative', height: 220 }}>
              <StageDistributionChart data={dashboard.stageDistribution} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dashboard.stageDistribution.map((s, i) => {
                const total = dashboard.stageDistribution.reduce((sum, x) => sum + parseInt(x.count), 0);
                const pct = total > 0 ? ((parseInt(s.count) / total) * 100).toFixed(1) : 0;
                return (
                  <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: ({ received: '#64748b', inspection: '#3b82f6', diagnosis: '#6366f1', quotation: '#f59e0b', approved: '#10b981', rejected: '#ef4444', recovery_in_progress: '#00d4ff', imaging: '#7c3aed', data_extraction: '#ec4899', verification: '#fbbf24', completed: '#10b981', delivered: '#00d4ff', failed: '#dc2626' }[s.stage] || '#94a3b8'), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.stage?.replace(/_/g, ' ')}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                      <div style={{ fontWeight: 700 }}>{s.count}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{pct}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Revenue Trend */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Revenue Trend (Last 30 Days)</div>
          </div>
          <RevenueTrendChart data={revenueTrend} />
          {revenueTrend.length > 0 && (
            <div style={{ marginTop: 12, padding: '8px 0', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 20, fontSize: '0.75rem' }}>
              <span className="text-muted">Total: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>₹{revenueTrend.reduce((s, d) => s + parseFloat(d.revenue || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></span>
              <span className="text-muted">Avg/day: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>₹{(revenueTrend.reduce((s, d) => s + parseFloat(d.revenue || 0), 0) / revenueTrend.length).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></span>
            </div>
          )}
        </div>

        {/* Failure by Type */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Failure Type Distribution</div>
          </div>
          <FailureTypeChart data={failureTypeData} />
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Brand-wise */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Cases by Brand</div>
          </div>
          <BrandDistributionChart data={failureBrandData} />
        </div>

        {/* Case Status Pie Chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Case Status Overview</div>
          </div>
          <div style={{ position: 'relative', height: 220 }}>
            <CaseStatusChart total={c.total || 0} active={c.active || 0} completed={c.completed || 0} failed={c.failed || 0} />
          </div>
        </div>
      </div>

      {/* Model Failure Analytics */}
      {modelFailures.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Model-Level Recovery Analytics</div>
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
