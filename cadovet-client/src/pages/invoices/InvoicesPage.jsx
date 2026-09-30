import React, { useState, useEffect, useContext } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { getInvoices, createInvoice, updateInvoiceStatus, deleteInvoice } from '../../services/invoiceApi';
import { getCustomers } from '../../services/customerApi';
import { getPets } from '../../services/petApi';
import { AuthContext } from '../../context/AuthContext';

const STATUS_BADGES = {
  PAID: { bg: '#f0fff4', text: '#22543d', border: '#c6f6d5', label: 'PAID' },
  PENDING: { bg: '#fffaf0', text: '#7b341e', border: '#feebc8', label: 'PENDING' },
  CANCELLED: { bg: '#fff5f5', text: '#742a2a', border: '#fed7d7', label: 'CANCELLED' }
};

const InvoicesPage = () => {
  const { hasPermission } = useContext(AuthContext);
  const [invoices, setInvoices] = useState([]);
  const [metrics, setMetrics] = useState({ totalRevenue: 0, pendingAmount: 0, paidCount: 0, pendingCount: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  // Dropdown data
  const [customers, setCustomers] = useState([]);
  const [pets, setPets] = useState([]);
  const [filteredPets, setFilteredPets] = useState([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Form State
  const initialForm = {
    customer_id: '',
    pet_id: '',
    subtotal: '',
    tax: '0',
    discount: '0',
    payment_status: 'PAID',
    payment_method: 'UPI',
    invoice_date: new Date().toISOString().split('T')[0],
    notes: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchInvoicesList = async () => {
    setLoading(true);
    try {
      const res = await getInvoices({
        status: statusFilter,
        search,
        limit: 50
      });
      setInvoices(res.data.data || []);
      setMetrics(res.data.metrics || { totalRevenue: 0, pendingAmount: 0, paidCount: 0, pendingCount: 0 });
    } catch (e) {
      console.error('Failed to load invoices:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        getCustomers({ limit: 100 }),
        getPets({ limit: 200 })
      ]);
      setCustomers(cRes.data.data || []);
      setPets(pRes.data.data || []);
    } catch (e) {
      console.error('Failed to load customers/pets:', e);
    }
  };

  useEffect(() => {
    fetchInvoicesList();
  }, [statusFilter, search]);

  useEffect(() => {
    fetchDropdowns();
  }, []);

  const handleCustomerChange = (cid) => {
    setFormData(prev => ({ ...prev, customer_id: cid, pet_id: '' }));
    if (!cid) {
      setFilteredPets([]);
    } else {
      setFilteredPets(pets.filter(p => String(p.customer_id) === String(cid)));
    }
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.customer_id || !formData.subtotal) {
      setFormError('Customer and Subtotal are required.');
      return;
    }
    setSaving(true);
    try {
      await createInvoice(formData);
      showToast('Invoice generated successfully! 💳');
      setShowAddModal(false);
      setFormData(initialForm);
      fetchInvoicesList();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      await updateInvoiceStatus(id, { payment_status: 'PAID' });
      showToast('Invoice marked as PAID! 💰');
      fetchInvoicesList();
      if (selectedInvoice && selectedInvoice.id === id) {
        setSelectedInvoice(prev => ({ ...prev, payment_status: 'PAID' }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update invoice');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await deleteInvoice(id);
      showToast('Invoice removed.');
      fetchInvoicesList();
      setShowDetailModal(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete invoice');
    }
  };

  return (
    <AdminLayout>
      <div style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
            background: 'linear-gradient(135deg, #1BAFBF, #0d9aaa)', color: '#fff',
            padding: '14px 24px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <span>✓</span> {toast}
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-dark)', letterSpacing: '-0.5px' }}>
              Billing & Invoices
            </h1>
            <p style={{ color: 'var(--text-light)', fontSize: '14px', marginTop: '4px' }}>
              Hospital treatment billing, consultation fees, pharmacy receipts, and payments ledger
            </p>
          </div>
          <button
            onClick={() => { setFormData(initialForm); setFormError(''); setShowAddModal(true); }}
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
              color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px',
              fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(27,175,191,0.35)'
            }}
          >
            <span>💳</span> Generate New Invoice
          </button>
        </div>

        {/* Revenue Metrics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '13px', color: '#276749', fontWeight: '600' }}>Total Collected Revenue</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#276749', marginTop: '6px' }}>
              ₹{metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px' }}>
              {metrics.paidCount} Paid Invoices
            </div>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '13px', color: '#c53030', fontWeight: '600' }}>Pending Balances</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#c53030', marginTop: '6px' }}>
              ₹{metrics.pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px' }}>
              {metrics.pendingCount} Invoices awaiting payment
            </div>
          </div>

          <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: '600' }}>Total Invoices Issued</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-dark)', marginTop: '6px' }}>
              {invoices.length}
            </div>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div style={{
          background: '#fff', padding: '16px 20px', borderRadius: '16px',
          boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '16px', marginBottom: '24px'
        }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL', 'PAID', 'PENDING', 'CANCELLED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
                  border: statusFilter === st ? 'none' : '1px solid var(--border)',
                  background: statusFilter === st ? 'var(--primary)' : '#f7fafc',
                  color: statusFilter === st ? '#fff' : 'var(--text-medium)',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {st === 'ALL' ? 'All Invoices' : st}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ minWidth: '280px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by invoice #, customer, or pet..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '8px 14px' }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
              <div>Loading hospital billing ledger...</div>
            </div>
          ) : invoices.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🧾</div>
              <h3 style={{ color: 'var(--text-dark)', fontWeight: '700' }}>No Invoices Found</h3>
              <p style={{ fontSize: '14px', marginTop: '4px' }}>There are no invoices matching your search.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid var(--border)', color: 'var(--text-medium)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '16px 20px' }}>Invoice Number</th>
                    <th style={{ padding: '16px 20px' }}>Customer & Pet</th>
                    <th style={{ padding: '16px 20px' }}>Date</th>
                    <th style={{ padding: '16px 20px' }}>Method</th>
                    <th style={{ padding: '16px 20px' }}>Amount</th>
                    <th style={{ padding: '16px 20px' }}>Status</th>
                    <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const badge = STATUS_BADGES[inv.payment_status] || STATUS_BADGES.PENDING;
                    return (
                      <tr key={inv.id} style={{ borderBottom: '1px solid #edf2f7', transition: 'background 0.15s' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: '800', color: 'var(--primary-dark)', fontFamily: 'monospace', fontSize: '15px' }}>
                            {inv.invoice_number}
                          </div>
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-dark)' }}>{inv.customer_name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                            Patient: {inv.pet_name ? `${inv.pet_name} (${inv.pet_species})` : 'General Clinic'}
                          </div>
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-dark)' }}>
                            {new Date(inv.invoice_date).toLocaleDateString()}
                          </div>
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          <span style={{
                            fontSize: '11px', fontWeight: '700', padding: '4px 8px', borderRadius: '6px',
                            background: '#edf2f7', color: 'var(--text-dark)'
                          }}>
                            {inv.payment_method}
                          </span>
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-dark)' }}>
                            ₹{inv.total_amount}
                          </div>
                          {(inv.tax > 0 || inv.discount > 0) && (
                            <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                              Sub: ₹{inv.subtotal} {inv.discount > 0 && `(-₹${inv.discount})`}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          <span style={{
                            padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                            background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`
                          }}>
                            {badge.label}
                          </span>
                        </td>

                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => { setSelectedInvoice(inv); setShowDetailModal(true); }}
                              style={{
                                padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                                background: '#fff', color: 'var(--text-dark)', cursor: 'pointer', fontSize: '13px',
                                fontWeight: '600'
                              }}
                            >
                              Receipt
                            </button>
                            {inv.payment_status === 'PENDING' && (
                              <button
                                onClick={() => handleMarkPaid(inv.id)}
                                style={{
                                  padding: '6px 12px', borderRadius: '8px', border: 'none',
                                  background: '#c6f6d5', color: '#22543d', cursor: 'pointer', fontSize: '13px',
                                  fontWeight: '600'
                                }}
                              >
                                ✓ Mark Paid
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(inv.id)}
                              style={{
                                padding: '6px 10px', borderRadius: '8px', border: 'none',
                                background: '#fed7d7', color: '#742a2a', cursor: 'pointer', fontSize: '13px',
                                fontWeight: '600'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Generate Invoice */}
        {showAddModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
          }}>
            <div style={{
              background: '#fff', borderRadius: '20px', maxWidth: '600px', width: '100%',
              padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-dark)' }}>Generate Hospital Invoice</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}
                >
                  ✕
                </button>
              </div>

              {formError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{formError}</div>}

              <form onSubmit={handleCreateInvoice}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label">Customer *</label>
                    <select
                      className="form-input"
                      value={formData.customer_id}
                      onChange={(e) => handleCustomerChange(e.target.value)}
                      required
                    >
                      <option value="">Select Pet Parent</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.mobile || c.email})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Patient (Pet)</label>
                    <select
                      className="form-input"
                      value={formData.pet_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, pet_id: e.target.value }))}
                      disabled={!formData.customer_id}
                    >
                      <option value="">Select Pet (Optional)</option>
                      {filteredPets.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.species})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label">Subtotal (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      placeholder="0.00"
                      value={formData.subtotal}
                      onChange={(e) => setFormData(prev => ({ ...prev, subtotal: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label">Tax (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={formData.tax}
                      onChange={(e) => setFormData(prev => ({ ...prev, tax: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="form-label">Discount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={formData.discount}
                      onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label">Payment Status</label>
                    <select
                      className="form-input"
                      value={formData.payment_status}
                      onChange={(e) => setFormData(prev => ({ ...prev, payment_status: e.target.value }))}
                    >
                      <option value="PAID">PAID</option>
                      <option value="PENDING">PENDING</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-input"
                      value={formData.payment_method}
                      onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                    >
                      <option value="UPI">UPI / Digital QR</option>
                      <option value="CARD">Credit / Debit Card</option>
                      <option value="CASH">Cash Payment</option>
                      <option value="ONLINE">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Billing Items / Notes</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder="e.g. Consultation fee, X-ray procedure, Antibiotic prescription..."
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    style={{
                      padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)',
                      background: '#fff', color: 'var(--text-medium)', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: '10px 24px', borderRadius: '10px', border: 'none',
                      background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                      color: '#fff', fontWeight: '700', cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(27,175,191,0.35)'
                    }}
                  >
                    {saving ? 'Issuing...' : 'Create Invoice'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Receipt View */}
        {showDetailModal && selectedInvoice && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
          }}>
            <div style={{
              background: '#fff', borderRadius: '20px', maxWidth: '580px', width: '100%',
              padding: '36px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px dashed #edf2f7', paddingBottom: '20px', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '24px' }}>🐾</span>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary-dark)' }}>CADOVET HOSPITAL</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px' }}>
                    Tax Invoice & Official Payment Receipt
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-dark)', fontFamily: 'monospace' }}>
                    {selectedInvoice.invoice_number}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
                    {new Date(selectedInvoice.invoice_date).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Billed To */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Billed To</div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-dark)', marginTop: '2px' }}>{selectedInvoice.customer_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-medium)' }}>{selectedInvoice.customer_mobile || selectedInvoice.customer_email}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Patient Details</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-dark)', marginTop: '2px' }}>
                    {selectedInvoice.pet_name ? `${selectedInvoice.pet_name} (${selectedInvoice.pet_species})` : 'General Client'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-medium)' }}>Payment Method: {selectedInvoice.payment_method}</div>
                </div>
              </div>

              {/* Notes */}
              {selectedInvoice.notes && (
                <div style={{ marginBottom: '20px', padding: '12px 16px', background: '#fff', border: '1px solid #edf2f7', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '700', textTransform: 'uppercase' }}>Description of Services / Meds</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-dark)', marginTop: '4px' }}>{selectedInvoice.notes}</div>
                </div>
              )}

              {/* Calculation Summary */}
              <div style={{ borderTop: '1px solid #edf2f7', paddingTop: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-light)' }}>Subtotal</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-dark)' }}>₹{selectedInvoice.subtotal}</span>
                </div>
                {selectedInvoice.tax > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-light)' }}>Taxes</span>
                    <span style={{ fontWeight: '600', color: 'var(--text-dark)' }}>+₹{selectedInvoice.tax}</span>
                  </div>
                )}
                {selectedInvoice.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-light)' }}>Discount</span>
                    <span style={{ fontWeight: '600', color: '#276749' }}>-₹{selectedInvoice.discount}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '800', borderTop: '2px solid #edf2f7', paddingTop: '10px', marginTop: '10px' }}>
                  <span style={{ color: 'var(--text-dark)' }}>Total Billed</span>
                  <span style={{ color: 'var(--primary-dark)' }}>₹{selectedInvoice.total_amount}</span>
                </div>
              </div>

              {/* Action */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                  background: STATUS_BADGES[selectedInvoice.payment_status]?.bg,
                  color: STATUS_BADGES[selectedInvoice.payment_status]?.text,
                  border: `1px solid ${STATUS_BADGES[selectedInvoice.payment_status]?.border}`
                }}>
                  {selectedInvoice.payment_status}
                </span>

                <button
                  onClick={() => setShowDetailModal(false)}
                  style={{
                    padding: '8px 24px', borderRadius: '10px', border: 'none',
                    background: 'var(--primary)', color: '#fff', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default InvoicesPage;
