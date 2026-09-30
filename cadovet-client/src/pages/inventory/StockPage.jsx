import React, { useState, useEffect, useContext } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { getInventory, createInventoryItem, updateInventoryItem, adjustStock, deleteInventoryItem, dispenseToDoctor } from '../../services/inventoryApi';
import { getDoctors } from '../../services/doctorApi';
import { AuthContext } from '../../context/AuthContext';

const STATUS_BADGES = {
  IN_STOCK: { bg: '#f0fff4', text: '#22543d', border: '#c6f6d5', label: 'In Stock' },
  LOW_STOCK: { bg: '#fffaf0', text: '#7b341e', border: '#feebc8', label: 'Low Stock' },
  OUT_OF_STOCK: { bg: '#fff5f5', text: '#742a2a', border: '#fed7d7', label: 'Out of Stock' }
};

const isExpired = (item) => item.expiry_date && new Date(item.expiry_date) < new Date(new Date().toDateString());

// Shared by the Pharmacy and Inventory pages — same table/behavior, scoped to a different department and set of
// categories. The backend already restricts a Pharmacy/Inventory desk account to its own department; passing
// `department` here also scopes the view for ADMIN/OPERATIONAL_HEAD, who aren't locked to one desk.
const StockPage = ({ department, title, subtitle, icon, categories, itemNoun }) => {
  const { hasPermission } = useContext(AuthContext);
  const canManage = hasPermission('INVENTORY_MANAGE');
  const [items, setItems] = useState([]);
  const [metrics, setMetrics] = useState({ totalItems: 0, lowStockItems: 0, outOfStockItems: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [doctors, setDoctors] = useState([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [dispenseItem, setDispenseItem] = useState(null);

  const initialForm = {
    name: '', category: categories[0], sku: '', stock_quantity: 50, min_alert_quantity: 15,
    unit_price: '15.00', expiry_date: '', supplier: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await getInventory({
        department,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search,
        limit: 100
      });
      setItems(res.data.data || []);
      setMetrics(res.data.metrics || { totalItems: 0, lowStockItems: 0, outOfStockItems: 0 });
    } catch (e) {
      console.error('Failed to load stock:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, [selectedCategory, statusFilter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!canManage) return;
    getDoctors({ limit: 100 }).then((res) => setDoctors((res.data.data || []).filter((d) => d.status === 'ACTIVE'))).catch(() => {});
  }, [canManage]);

  const handleOpenAdd = () => { setFormData(initialForm); setFormError(''); setShowAddModal(true); };

  const handleOpenEdit = (item) => {
    setSelectedItem(item);
    setFormData({
      name: item.name, category: item.category, sku: item.sku, stock_quantity: item.stock_quantity,
      min_alert_quantity: item.min_alert_quantity, unit_price: item.unit_price,
      expiry_date: item.expiry_date ? item.expiry_date.split('T')[0] : '', supplier: item.supplier || ''
    });
    setFormError('');
    setShowEditModal(true);
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.name || !formData.sku || !formData.category) return setFormError('Name, SKU, and Category are required.');
    setSaving(true);
    try {
      await createInventoryItem({ ...formData, department });
      showToast(`${itemNoun} added successfully!`);
      setShowAddModal(false);
      fetchList();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await updateInventoryItem(selectedItem.id, formData);
      showToast(`${itemNoun} updated successfully!`);
      setShowEditModal(false);
      fetchList();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAdjust = async (id, delta) => {
    try {
      await adjustStock(id, delta);
      showToast(`Stock updated (${delta > 0 ? '+' + delta : delta})`);
      fetchList();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to adjust stock');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      await deleteInventoryItem(id);
      showToast('Item deleted.');
      fetchList();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete item');
    }
  };

  return (
    <AdminLayout>
      <div style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto' }}>
        {toast && (
          <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, background: 'linear-gradient(135deg, #1BAFBF, #0d9aaa)', color: '#fff', padding: '14px 24px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✓</span> {toast}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-dark)', letterSpacing: '-0.5px' }}>{icon} {title}</h1>
            <p style={{ color: 'var(--text-light)', fontSize: '14px', marginTop: '4px' }}>{subtitle}</p>
          </div>
          {canManage && (
            <button onClick={handleOpenAdd} style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(27,175,191,0.35)' }}>
              <span>{icon}</span> Add {itemNoun}
            </button>
          )}
        </div>

        {/* Metrics + quick filter buttons (Low Stock / Out of Stock) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <button
            onClick={() => { setStatusFilter('ALL'); setSelectedCategory('ALL'); }}
            title="Show the full list"
            style={{ textAlign: 'left', background: statusFilter === 'ALL' && selectedCategory === 'ALL' ? 'var(--primary-light)' : '#fff', padding: '20px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: statusFilter === 'ALL' && selectedCategory === 'ALL' ? '1.5px solid var(--primary)' : '1px solid var(--border)', cursor: 'pointer' }}
          >
            <div style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: '600' }}>Total SKUs {statusFilter === 'ALL' && selectedCategory === 'ALL' ? '(showing)' : '— tap to show all'}</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-dark)', marginTop: '6px' }}>{metrics.totalItems}</div>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK')}
            style={{ textAlign: 'left', background: statusFilter === 'LOW_STOCK' ? '#fffaf0' : '#fff', padding: '20px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: statusFilter === 'LOW_STOCK' ? '1.5px solid #dd6b20' : '1px solid var(--border)', cursor: 'pointer' }}
          >
            <div style={{ fontSize: '13px', color: '#dd6b20', fontWeight: '600' }}>⚠️ Low Stock {statusFilter === 'LOW_STOCK' ? '(showing)' : ''}</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#dd6b20', marginTop: '6px' }}>{metrics.lowStockItems}</div>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK')}
            style={{ textAlign: 'left', background: statusFilter === 'OUT_OF_STOCK' ? '#fff5f5' : '#fff', padding: '20px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: statusFilter === 'OUT_OF_STOCK' ? '1.5px solid #e53e3e' : '1px solid var(--border)', cursor: 'pointer' }}
          >
            <div style={{ fontSize: '13px', color: '#e53e3e', fontWeight: '600' }}>⛔ Out of Stock {statusFilter === 'OUT_OF_STOCK' ? '(showing)' : ''}</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#e53e3e', marginTop: '6px' }}>{metrics.outOfStockItems}</div>
          </button>
        </div>

        {/* Category pills & search */}
        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flexWrap: 'wrap' }}>
            {['ALL', ...categories].map((cat) => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', border: selectedCategory === cat ? 'none' : '1px solid var(--border)', background: selectedCategory === cat ? 'var(--primary)' : '#f7fafc', color: selectedCategory === cat ? '#fff' : 'var(--text-medium)', cursor: 'pointer' }}>
                {cat === 'ALL' ? `All ${title}` : cat}
              </button>
            ))}
          </div>
          <div style={{ minWidth: '280px' }}>
            <input type="text" className="form-input" placeholder="Search by name, SKU, or supplier..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '8px 14px' }} />
          </div>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>{icon}</div>
              <h3 style={{ color: 'var(--text-dark)', fontWeight: '700' }}>No {title} Found</h3>
              <p style={{ fontSize: '14px', marginTop: '4px' }}>Nothing matches the selected filters.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid var(--border)', color: 'var(--text-medium)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '16px 20px' }}>Item & SKU</th>
                    <th style={{ padding: '16px 20px' }}>Category</th>
                    <th style={{ padding: '16px 20px' }}>Unit Price</th>
                    <th style={{ padding: '16px 20px' }}>Current Stock</th>
                    <th style={{ padding: '16px 20px' }}>Status</th>
                    <th style={{ padding: '16px 20px' }}>Supplier / Expiry</th>
                    <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const badge = STATUS_BADGES[item.status] || STATUS_BADGES.IN_STOCK;
                    const expired = isExpired(item);
                    // Expired wins over low-stock for the name's color, per the requested rule.
                    const nameColor = expired ? '#c53030' : item.status === 'LOW_STOCK' ? '#b7791f' : 'var(--text-dark)';
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: '700', color: nameColor }}>{item.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-light)', fontFamily: 'monospace' }}>SKU: {item.sku}</div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', background: '#edf2f7', color: 'var(--text-medium)' }}>{item.category}</span>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-dark)' }}>₹{item.unit_price}</div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: '800', fontSize: '16px', color: item.status === 'LOW_STOCK' ? '#b7791f' : item.status === 'OUT_OF_STOCK' ? '#c53030' : 'var(--text-dark)' }}>{item.stock_quantity}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Min Alert: {item.min_alert_quantity}</div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>{badge.label}</span>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontSize: '13px', color: 'var(--text-dark)' }}>{item.supplier || 'Standard'}</div>
                          {item.expiry_date && (
                            <div style={{ fontSize: '11px', fontWeight: expired ? '700' : '400', color: expired ? '#c53030' : 'var(--text-light)' }}>
                              {expired ? '⚠ Expired ' : 'Exp: '}{new Date(item.expiry_date).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          {canManage && (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                              <button onClick={() => setDispenseItem(item)} title="Dispense to a doctor" style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--primary)', background: '#fff', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
                                🎒 Dispense
                              </button>
                              <button onClick={() => handleQuickAdjust(item.id, -1)} title="Decrease 1" style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-dark)', cursor: 'pointer', fontWeight: '700' }}>-1</button>
                              <button onClick={() => handleQuickAdjust(item.id, 5)} title="Add 5" style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary-dark)', cursor: 'pointer', fontWeight: '700' }}>+5</button>
                              <button onClick={() => handleOpenEdit(item)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: '#f8fafc', color: 'var(--text-dark)', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Edit</button>
                              <button onClick={() => handleDelete(item.id, item.name)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: '#fed7d7', color: '#742a2a', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add/Edit modal */}
        {(showAddModal || showEditModal) && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: '#fff', borderRadius: '20px', maxWidth: '560px', width: '100%', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-dark)' }}>{showAddModal ? `Add ${itemNoun}` : `Edit ${itemNoun}`}</h2>
                <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
              </div>
              {formError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{formError}</div>}
              <form onSubmit={showAddModal ? handleSaveAdd : handleSaveEdit}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input type="text" className="form-input" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label">Category *</label>
                    <select className="form-input" value={formData.category} onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))} required>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">SKU / Item Code *</label>
                    <input type="text" className="form-input" value={formData.sku} onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))} required />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label">Stock Quantity</label>
                    <input type="number" className="form-input" value={formData.stock_quantity} onChange={(e) => setFormData((prev) => ({ ...prev, stock_quantity: e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label">Min Alert Qty</label>
                    <input type="number" className="form-input" value={formData.min_alert_quantity} onChange={(e) => setFormData((prev) => ({ ...prev, min_alert_quantity: e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label">Unit Price (₹)</label>
                    <input type="number" step="0.01" className="form-input" value={formData.unit_price} onChange={(e) => setFormData((prev) => ({ ...prev, unit_price: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label">Expiry Date</label>
                    <input type="date" className="form-input" value={formData.expiry_date} onChange={(e) => setFormData((prev) => ({ ...prev, expiry_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label">Supplier</label>
                    <input type="text" className="form-input" value={formData.supplier} onChange={(e) => setFormData((prev) => ({ ...prev, supplier: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button type="button" onClick={() => { setShowAddModal(false); setShowEditModal(false); }} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-medium)', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '10px 24px' }}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dispense modal */}
        {dispenseItem && (
          <DispenseModal
            item={dispenseItem}
            doctors={doctors}
            onClose={() => setDispenseItem(null)}
            onDone={(msg) => { setDispenseItem(null); showToast(msg); fetchList(); }}
          />
        )}
      </div>
    </AdminLayout>
  );
};

const DispenseModal = ({ item, doctors, onClose, onDone }) => {
  const [doctorId, setDoctorId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!doctorId) return setError('Select a doctor.');
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) return setError('Quantity must be a positive whole number.');
    if (qty > item.stock_quantity) return setError(`Only ${item.stock_quantity} in stock.`);

    setSaving(true);
    try {
      await dispenseToDoctor(item.id, { doctor_id: Number(doctorId), quantity: qty, notes: notes.trim() || undefined });
      onDone(`${qty} × ${item.name} dispensed`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to dispense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>🎒 Dispense to a Doctor</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-medium)', marginBottom: '16px' }}>{item.name} — {item.stock_quantity} in stock</div>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Doctor *</label>
            <select className="form-input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
              <option value="">Select doctor</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Quantity *</label>
            <input type="number" min="1" max={item.stock_quantity} className="form-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Notes</label>
            <input type="text" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-medium)', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '10px 24px' }}>{saving ? 'Sending…' : 'Dispense'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockPage;
