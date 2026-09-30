import React, { useState, useEffect } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { getInventoryTransactions, recordMedicineUsage, raiseDispute } from '../../services/inventoryApi';
import { getPets } from '../../services/petApi';

const DISPUTE_BADGE = {
  PENDING_REVIEW: { label: 'Reported — pending review', bg: '#fffaf0', color: '#b7791f' },
  FORWARDED: { label: 'Forwarded to department', bg: '#ebf8ff', color: '#2b6cb0' },
  RESOLVED: { label: 'Resolved', bg: '#f0fff4', color: '#276749' },
};

// A doctor's own view: what Pharmacy/Inventory has dispensed to them (their "bag"), and a way to log what they
// used on a visit. Both come from the same inventory_transactions log, scoped server-side to this doctor.
const MyStockPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [useTarget, setUseTarget] = useState(null);
  const [disputeTarget, setDisputeTarget] = useState(null);
  const [viewTxn, setViewTxn] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await getInventoryTransactions();
      setTransactions(res.data.data || []);
    } catch (e) {
      console.error('Failed to load my stock:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { getPets({ limit: 200 }).then((res) => setPets(res.data.data || [])).catch(() => {}); }, []);

  // Balance in the doctor's bag per item: everything dispensed to them, minus what they've already used.
  const bag = {};
  transactions.forEach((t) => {
    if (!bag[t.inventory_id]) bag[t.inventory_id] = { inventory_id: t.inventory_id, item_name: t.item_name, sku: t.sku, category: t.category, balance: 0 };
    bag[t.inventory_id].balance += t.type === 'DISPENSE_TO_DOCTOR' ? t.quantity : -t.quantity;
  });
  const bagItems = Object.values(bag).filter((b) => b.balance > 0);

  return (
    <AdminLayout>
      {toast && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, background: 'linear-gradient(135deg, #1BAFBF, #0d9aaa)', color: '#fff', padding: '14px 24px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', fontWeight: '600', fontSize: '14px' }}>
          {toast}
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-dark)' }}>🎒 My Pharmacy & Inventory</h1>
        <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '2px' }}>
          What Pharmacy and Inventory have given you, and what you've used on a visit — never the full catalog.
        </div>
      </div>

      <div style={{ marginBottom: '16px', fontSize: '14px', fontWeight: '800', color: 'var(--text-dark)' }}>In My Bag</div>
      <div className="card" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '28px' }}>
        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-light)' }}>Loading…</div>
        ) : bagItems.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>🎒</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-dark)' }}>Nothing dispensed to you yet</div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-light)', marginTop: '4px' }}>Ask the Pharmacy or Inventory desk to dispense items to you for a visit.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-light)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Item</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Category</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Have on hand</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}></th>
              </tr>
            </thead>
            <tbody>
              {bagItems.map((b) => (
                <tr key={b.inventory_id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--text-dark)' }}>{b.item_name}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-medium)' }}>{b.category}</td>
                  <td style={{ padding: '14px 16px', fontWeight: '800', fontSize: '15px', color: 'var(--text-dark)' }}>{b.balance}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button onClick={() => setUseTarget(b)} className="btn-primary" style={{ padding: '6px 16px', fontSize: '12.5px' }}>Log usage</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginBottom: '16px', fontSize: '14px', fontWeight: '800', color: 'var(--text-dark)' }}>Transaction History</div>
      <div className="card" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-light)' }}>Loading…</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px' }}>No activity yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-light)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Item</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Qty</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Type</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Detail</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}>Slip</th>
                <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase' }}></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-medium)', whiteSpace: 'nowrap' }}>{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: 'var(--text-dark)' }}>{t.item_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-dark)' }}>{t.quantity}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: 'var(--radius-full)', background: t.type === 'DISPENSE_TO_DOCTOR' ? 'rgba(27,175,191,0.1)' : 'rgba(233,30,99,0.1)', color: t.type === 'DISPENSE_TO_DOCTOR' ? 'var(--primary)' : '#E91E63' }}>
                      {t.type === 'DISPENSE_TO_DOCTOR' ? 'Received' : 'Used'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12.5px', color: 'var(--text-light)' }}>
                    {t.type === 'DISPENSE_TO_DOCTOR' ? `From ${t.performed_by_name || 'desk'}` : (t.pet_name ? `On ${t.pet_name}` : '')}{t.notes ? ` — ${t.notes}` : ''}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {t.slip_image_url ? (
                      <a href={t.slip_image_url} target="_blank" rel="noreferrer" title="View medicine slip photo">
                        <img src={t.slip_image_url} alt="Medicine slip" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)', display: 'block' }} />
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-light)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      {t.type === 'DISPENSE_TO_DOCTOR' && (
                        t.dispute_status ? (
                          <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: 'var(--radius-full)', background: DISPUTE_BADGE[t.dispute_status].bg, color: DISPUTE_BADGE[t.dispute_status].color }}>
                            {DISPUTE_BADGE[t.dispute_status].label}
                          </span>
                        ) : (
                          <button onClick={() => setDisputeTarget(t)} style={{ background: 'none', border: '1px solid #e53e3e', color: '#e53e3e', borderRadius: '8px', padding: '4px 10px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}>
                            ⚠️ Report an issue
                          </button>
                        )
                      )}
                      <button onClick={() => setViewTxn(t)} style={{ padding: '4px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--primary)', fontWeight: '700', fontSize: '11.5px', cursor: 'pointer' }}>
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewTxn && <TransactionDetailModal txn={viewTxn} onClose={() => setViewTxn(null)} />}

      {useTarget && (
        <UseModal
          item={useTarget}
          pets={pets}
          onClose={() => setUseTarget(null)}
          onDone={(msg) => { setUseTarget(null); showToast(msg); fetchAll(); }}
        />
      )}
      {disputeTarget && (
        <DisputeModal
          transaction={disputeTarget}
          onClose={() => setDisputeTarget(null)}
          onDone={(msg) => { setDisputeTarget(null); showToast(msg); fetchAll(); }}
        />
      )}
    </AdminLayout>
  );
};

// Full detail behind one "View" click — every field the row carries, plus a bigger look at the slip photo
// than the 32px thumbnail. Only ever this doctor's own transactions (the backend scopes the whole list to
// them), so there's no doctor name/filter to show here — unlike the same list on the admin/desk side.
const TransactionDetailModal = ({ txn, onClose }) => {
  const row = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-dark)', textAlign: 'right' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', maxWidth: '480px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>💊 Transaction Detail</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
        </div>

        {row('Date', new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))}
        {row('Item', txn.item_name)}
        {row('Quantity', txn.quantity)}
        {row('Type', txn.type === 'DISPENSE_TO_DOCTOR' ? 'Received' : 'Used')}
        {txn.type === 'DISPENSE_TO_DOCTOR' ? row('From', txn.performed_by_name || 'desk') : txn.pet_name && row('On patient', txn.pet_name)}
        {row('Notes', txn.notes || '—')}

        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '8px' }}>Medicine Slip</div>
          {txn.slip_image_url ? (
            <a href={txn.slip_image_url} target="_blank" rel="noreferrer">
              <img src={txn.slip_image_url} alt="Medicine slip" style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '10px', border: '1px solid var(--border)', display: 'block', background: 'var(--bg-light)' }} />
            </a>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px', background: 'var(--bg-light)', borderRadius: '10px' }}>No slip photo attached</div>
          )}
        </div>
      </div>
    </div>
  );
};

const UseModal = ({ item, pets, onClose, onDone }) => {
  const [petId, setPetId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!petId) return setError('Select the patient this was used on.');
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) return setError('Quantity must be a positive whole number.');
    if (qty > item.balance) return setError(`You only have ${item.balance} on hand.`);

    setSaving(true);
    try {
      await recordMedicineUsage(item.inventory_id, { pet_id: Number(petId), quantity: qty, notes: notes.trim() || undefined });
      onDone(`Logged ${qty} × ${item.item_name} used`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to log usage');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>Log Usage</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-medium)', marginBottom: '16px' }}>{item.item_name} — {item.balance} on hand</div>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Patient (Pet) *</label>
            <select className="form-input" value={petId} onChange={(e) => setPetId(e.target.value)} required>
              <option value="">Select pet</option>
              {pets.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.species} — Owner: {p.owner_name || p.customer_name})</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Quantity used *</label>
            <input type="number" min="1" max={item.balance} className="form-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Notes</label>
            <input type="text" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-medium)', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '10px 24px' }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DisputeModal = ({ transaction, onClose, onDone }) => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!message.trim()) return setError('Describe what looks wrong.');

    setSaving(true);
    try {
      await raiseDispute(transaction.id, { message: message.trim() });
      onDone('Sent to the operational head for review');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send report');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>⚠️ Report an Issue</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-medium)', marginBottom: '16px' }}>
          {transaction.quantity} × {transaction.item_name}, from {transaction.performed_by_name || 'the desk'}
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">What's wrong? *</label>
            <textarea className="form-input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. I only received 5, not the 10 logged here" />
            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>This goes to the operational head first, who verifies it before forwarding to the department.</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-medium)', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '10px 24px' }}>{saving ? 'Sending…' : 'Send Report'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MyStockPage;
