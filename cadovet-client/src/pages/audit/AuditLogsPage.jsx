import React, { useState, useEffect } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { getAuditLogs } from '../../services/adminApi';

const ACTION_COLORS = {
  LOGIN: '#4CAF50', LOGOUT: '#9E9E9E',
  CUSTOMER_CREATED: '#2196F3', CUSTOMER_UPDATED: '#FF9800',
  USER_CREATED: '#9C27B0', USER_UPDATED: '#FF5722',
  ROLE_CHANGED: '#E91E63', PERMISSION_CHANGED: '#F44336',
};

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [filters, setFilters] = useState({ module: '', action: '' });

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const res = await getAuditLogs({ ...filters, page, limit: 30 });
      setLogs(res.data.data);
      setPagination(res.data.pagination);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(1); }, [filters]);

  return (
    <AdminLayout>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-dark)' }}>Audit Logs</h1>
        <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '2px' }}>
          Complete record of all system actions — {pagination.total} total entries
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select className="form-input" style={{ width: '180px' }} value={filters.module} onChange={e => setFilters({ ...filters, module: e.target.value })}>
          <option value="">All Modules</option>
          {['AUTH', 'USERS', 'CUSTOMERS', 'ROLES', 'APPOINTMENTS', 'ORDERS'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="form-input" style={{ width: '220px' }} value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value })}>
          <option value="">All Actions</option>
          {Object.keys(ACTION_COLORS).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={() => setFilters({ module: '', action: '' })} style={{ padding: '10px 16px', background: 'var(--bg-light)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '13px', fontFamily: 'Poppins, sans-serif', color: 'var(--text-medium)' }}>
          ✕ Clear
        </button>
      </div>

      <div className="card" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>Loading audit trail...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-dark)' }}>No audit logs found</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-light)', borderBottom: '1px solid var(--border)' }}>
                {['Time', 'User', 'Action', 'Module', 'Record ID', 'IP Address'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleDateString('en-IN')} {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-dark)', fontWeight: '500' }}>
                    {log.user_name || 'System'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: `${ACTION_COLORS[log.action] || '#888'}20`,
                      color: ACTION_COLORS[log.action] || '#888',
                      border: `1px solid ${ACTION_COLORS[log.action] || '#888'}40`,
                      borderRadius: 'var(--radius-full)', padding: '3px 10px', fontSize: '11px', fontWeight: '700'
                    }}>{log.action}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: 'var(--text-medium)' }}>{log.module}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-light)' }}>{log.record_id || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-light)', fontFamily: 'monospace' }}>{log.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
          {Array.from({ length: Math.min(pagination.pages, 10) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => fetchLogs(p)} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: pagination.page === p ? 'var(--primary)' : 'var(--border)', color: pagination.page === p ? '#fff' : 'var(--text-medium)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>{p}</button>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default AuditLogsPage;
