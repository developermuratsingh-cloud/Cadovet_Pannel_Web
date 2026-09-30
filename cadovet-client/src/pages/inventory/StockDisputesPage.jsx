import React, { useState, useEffect, useContext } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { AuthContext } from '../../context/AuthContext';
import { getDisputes, forwardDispute, dismissDispute, resolveDispute } from '../../services/inventoryApi';

const STATUS_BADGE = {
  PENDING_REVIEW: { label: 'Pending review', bg: '#fffaf0', color: '#b7791f' },
  FORWARDED: { label: 'Forwarded', bg: '#ebf8ff', color: '#2b6cb0' },
  RESOLVED: { label: 'Resolved', bg: '#f0fff4', color: '#276749' },
};

const Section = ({ title, rows, emptyText, renderAction }) => (
  <div style={{ marginBottom: '28px' }}>
    <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '800', color: 'var(--text-dark)' }}>{title}</div>
    <div className="card" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      {rows.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px' }}>{emptyText}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((d) => (
            <div key={d.id} style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '260px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-dark)' }}>{d.quantity} × {d.item_name}</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: 'var(--radius-full)', background: STATUS_BADGE[d.status].bg, color: STATUS_BADGE[d.status].color }}>
                    {STATUS_BADGE[d.status].label}
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-light)', marginBottom: '6px' }}>
                  Reported by {d.doctor_name} • {d.department_name} • {new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-medium)', background: 'var(--bg-light)', padding: '10px 14px', borderRadius: '10px' }}>{d.message}</div>
                {d.ops_note && <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '6px' }}>Ops note: {d.ops_note}</div>}
                {d.resolution_note && <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '6px' }}>Resolution: {d.resolution_note}</div>}
              </div>
              {renderAction && <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>{renderAction(d)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

// Doctor reports an issue with a dispensed item -> it's immediately visible to admin, the operational head, AND
// the desk that issued it (PHARMACY/INVENTORY, scoped to their own department) — whichever of them gets to it
// first can resolve it directly. Ops/admin additionally get "Verify & Forward" / "Dismiss" as an optional review
// step, but it's never a required gate before the desk (or anyone else) can act.
const StockDisputesPage = () => {
  const { user } = useContext(AuthContext);
  const canVerify = ['ADMIN', 'OPERATIONAL_HEAD'].includes(user?.role_name);
  const canResolve = ['ADMIN', 'OPERATIONAL_HEAD', 'PHARMACY', 'INVENTORY'].includes(user?.role_name);

  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [actionTarget, setActionTarget] = useState(null); // { dispute, kind: 'forward'|'dismiss'|'resolve' }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await getDisputes();
      setDisputes(res.data.data || []);
    } catch (e) {
      console.error('Failed to load reports:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const pending = disputes.filter((d) => d.status === 'PENDING_REVIEW');
  const forwarded = disputes.filter((d) => d.status === 'FORWARDED');
  const resolved = disputes.filter((d) => d.status === 'RESOLVED');

  return (
    <AdminLayout>
      {toast && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, background: 'linear-gradient(135deg, #1BAFBF, #0d9aaa)', color: '#fff', padding: '14px 24px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', fontWeight: '600', fontSize: '14px' }}>
          {toast}
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-dark)' }}>⚠️ Stock Issue Reports</h1>
        <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '2px' }}>
          A doctor flagged something wrong with a dispensed item — admin, the operational head, and your desk all see it the moment it's reported, and any one of you can resolve it.
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>Loading…</div>
      ) : (
        <>
          {canResolve && (
            <Section
              title={`Needs Action (${pending.length})`}
              rows={pending}
              emptyText="Nothing waiting right now."
              renderAction={(d) => (
                <>
                  <button onClick={() => setActionTarget({ dispute: d, kind: 'resolve' })} className="btn-primary" style={{ padding: '7px 16px', fontSize: '12.5px' }}>Resolve</button>
                  {canVerify && (
                    <>
                      <button onClick={() => setActionTarget({ dispute: d, kind: 'forward' })} style={{ padding: '7px 14px', fontSize: '12.5px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-medium)', cursor: 'pointer', fontWeight: '600' }}>Forward (note only)</button>
                      <button onClick={() => setActionTarget({ dispute: d, kind: 'dismiss' })} style={{ padding: '7px 14px', fontSize: '12.5px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-medium)', cursor: 'pointer', fontWeight: '600' }}>Dismiss</button>
                    </>
                  )}
                </>
              )}
            />
          )}

          <Section
            title={`Forwarded (${forwarded.length})`}
            rows={forwarded}
            emptyText="Nothing forwarded right now."
            renderAction={canResolve ? (d) => (
              <button onClick={() => setActionTarget({ dispute: d, kind: 'resolve' })} className="btn-primary" style={{ padding: '7px 16px', fontSize: '12.5px' }}>Mark Resolved</button>
            ) : null}
          />

          <Section title={`Resolved (${resolved.length})`} rows={resolved} emptyText="Nothing resolved yet." />
        </>
      )}

      {actionTarget && (
        <ActionModal
          target={actionTarget}
          onClose={() => setActionTarget(null)}
          onDone={(msg) => { setActionTarget(null); showToast(msg); fetchAll(); }}
        />
      )}
    </AdminLayout>
  );
};

const ACTION_COPY = {
  forward: { title: 'Forward', cta: 'Forward', placeholder: 'Optional note for the department' },
  dismiss: { title: 'Dismiss Report', cta: 'Dismiss', placeholder: 'Optional note for the doctor (why this needs no action)' },
  resolve: { title: 'Resolve Report', cta: 'Mark Resolved', placeholder: 'What was done (optional)' },
};

const ActionModal = ({ target, onClose, onDone }) => {
  const { dispute, kind } = target;
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const copy = ACTION_COPY[kind];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const fn = kind === 'forward' ? forwardDispute : kind === 'dismiss' ? dismissDispute : resolveDispute;
      await fn(dispute.id, { note: note.trim() || undefined });
      onDone(kind === 'forward' ? 'Forwarded to the department' : kind === 'dismiss' ? 'Dismissed' : 'Marked resolved');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>{copy.title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-medium)', marginBottom: '16px' }}>
          {dispute.quantity} × {dispute.item_name} — "{dispute.message}"
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Note</label>
            <textarea className="form-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={copy.placeholder} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-medium)', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '10px 24px' }}>{saving ? 'Saving…' : copy.cta}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockDisputesPage;
