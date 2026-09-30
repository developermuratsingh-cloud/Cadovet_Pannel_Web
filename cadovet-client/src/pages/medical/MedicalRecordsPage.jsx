import React, { useState, useEffect, useContext, useRef } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { getMedicalRecords, createMedicalRecord, deleteMedicalRecord } from '../../services/medicalRecordApi';
import { getPets } from '../../services/petApi';
import { getDoctors } from '../../services/doctorApi';
import { getDocuments, uploadDocument, getDocumentLink, resolveDocumentUrl } from '../../services/documentApi';
import { getInventoryTransactions } from '../../services/inventoryApi';
import { AuthContext } from '../../context/AuthContext';

const Modal = ({ title, onClose, children, width = 620 }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
    <div className="modal-scroll" style={{ background: '#fff', borderRadius: '20px', maxWidth: width, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-dark)' }}>{title}</h2>
        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

// A real "point the camera and click a photo" flow (the `capture` attribute on a file input only opens a
// device's native camera on mobile browsers — on desktop it just falls back to an ordinary file picker).
// getUserMedia works on any device with a camera and gives us a live preview plus a shutter button.
const CameraCaptureModal = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot access the camera. Use "Upload Picture" instead.');
      return undefined;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setReady(true);
      })
      .catch((err) => {
        setError(err.name === 'NotAllowedError'
          ? 'Camera access was denied. Allow camera access in your browser and try again.'
          : 'Could not access a camera on this device.');
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopStream = () => streamRef.current?.getTracks().forEach((t) => t.stop());

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      stopStream();
      onCapture(new File([blob], `prescription-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ color: '#fff', fontWeight: '700', fontSize: '15px' }}>📷 Take a Picture</span>
          <button onClick={() => { stopStream(); onClose(); }} aria-label="Close camera" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' }}>✕</button>
        </div>

        {error ? (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', textAlign: 'center' }}>
            <div style={{ fontSize: '13.5px', color: '#742a2a', marginBottom: '16px' }}>{error}</div>
            <button type="button" onClick={onClose} className="btn-primary" style={{ padding: '10px 24px' }}>Close</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: '16px', background: '#000', aspectRatio: '4 / 3', objectFit: 'cover' }} />
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '18px' }}>
              <button
                type="button"
                onClick={capture}
                disabled={!ready}
                aria-label="Capture photo"
                style={{ width: 64, height: 64, borderRadius: '50%', border: '4px solid #fff', background: ready ? 'var(--primary)' : '#666', cursor: ready ? 'pointer' : 'not-allowed' }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const WritePrescriptionModal = ({ pets, onClose, onDone }) => {
  const [petId, setPetId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!petId) return setError('Select the patient this prescription is for.');
    if (!note.trim()) return setError('Write the prescription note.');

    setSaving(true);
    try {
      // The note is the prescription itself (medicines, dosage, instructions — however the doctor wants to write it).
      await createMedicalRecord({ pet_id: petId, diagnosis: note.trim(), note_only: true });
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save prescription');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="✍️ Write a Prescription" onClose={onClose} width={480}>
      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-error" role="alert" style={{ marginBottom: '16px' }}>{error}</div>}

        <div style={{ marginBottom: '16px' }}>
          <label className="form-label">Patient (Pet) *</label>
          <select className="form-input" value={petId} onChange={(e) => setPetId(e.target.value)} required>
            <option value="">Select Pet Patient</option>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.species} — Owner: {p.owner_name || p.customer_name})</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label className="form-label">Prescription *</label>
          <textarea
            className="form-input"
            rows={7}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Amoxicillin 250mg — 1 tab twice daily for 5 days, after meals. Follow up in a week if symptoms persist."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-medium)', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '10px 24px', borderRadius: '10px' }}>{saving ? 'Sending…' : 'Send Prescription'}</button>
        </div>
      </form>
    </Modal>
  );
};

const UploadPrescriptionModal = ({ pets, onClose, onDone }) => {
  const [petId, setPetId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setPreviewUrl(null); return undefined; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!petId) return setError('Select the patient this prescription is for.');
    if (!file) return setError('Choose a file to upload (PDF, JPG, PNG or WEBP).');

    const form = new FormData();
    form.append('file', file);
    form.append('pet_id', petId);
    form.append('title', title.trim() || 'Prescription');
    if (notes.trim()) form.append('notes', notes.trim());

    setSaving(true);
    try {
      await uploadDocument(form);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload prescription');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="📎 Upload a Prescription" onClose={onClose} width={520}>
      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-error" role="alert" style={{ marginBottom: '16px' }}>{error}</div>}

        <div style={{ marginBottom: '16px' }}>
          <label className="form-label">Patient (Pet) *</label>
          <select className="form-input" value={petId} onChange={(e) => setPetId(e.target.value)} required>
            <option value="">Select Pet Patient</option>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.species} — Owner: {p.owner_name || p.customer_name})</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label className="form-label">Title</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Post-surgery medication slip" />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label className="form-label">File *</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--primary)', background: '#fff', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              📷 Take Picture
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text-medium)', fontWeight: '700', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              📁 Upload Picture
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] || null)} />

          {file && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-light)' }}>
              {previewUrl ? (
                <img src={previewUrl} alt="Selected prescription" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '8px' }} />
              ) : (
                <span style={{ fontSize: '20px' }}>📄</span>
              )}
              <span style={{ fontSize: '12.5px', color: 'var(--text-medium)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              <button type="button" onClick={() => setFile(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#e53e3e', fontSize: '14px', cursor: 'pointer' }}>✕</button>
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>PDF, JPG, PNG, WEBP or HEIC, up to 10 MB.</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the pet owner or operational head should know" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-medium)', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '10px 24px', borderRadius: '10px' }}>{saving ? 'Uploading…' : 'Upload & Send'}</button>
        </div>
      </form>

      {showCamera && (
        <CameraCaptureModal
          onCapture={(capturedFile) => { setFile(capturedFile); setShowCamera(false); }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </Modal>
  );
};

const MedicalRecordsPage = () => {
  const { user, hasPermission } = useContext(AuthContext);
  const [records, setRecords] = useState([]);
  const [pets, setPets] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [docs, setDocs] = useState([]);
  const [issuedByPet, setIssuedByPet] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [scannedPreviewUrls, setScannedPreviewUrls] = useState({});

  // Form State
  const initialForm = {
    pet_id: '',
    doctor_id: '',
    visit_date: new Date().toISOString().split('T')[0],
    symptoms: '',
    diagnosis: '',
    temperature_f: '',
    weight_kg: '',
    treatment_notes: '',
    follow_up_date: '',
    prescriptions: [
      { medicine_name: '', dosage: '', frequency: 'Once daily', duration_days: 5, instructions: '' }
    ]
  };
  const [formData, setFormData] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  // A doctor's own records are always attributed to themselves (the server ignores any doctor_id they send), so
  // the doctor picker is only meaningful — and only fetched — for staff who aren't a doctor.
  const isDoctor = user?.role_name === 'DOCTOR';
  const canManage = hasPermission('MEDICAL_RECORD_MANAGE');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [recRes, docRes, txnRes] = await Promise.all([
        getMedicalRecords({ search, limit: 50 }),
        getDocuments({ category: 'PRESCRIPTION' }),
        getInventoryTransactions({ type: 'USED_ON_PATIENT' }).catch(() => ({ data: { data: [] } })),
      ]);
      setRecords(recRes.data.data || []);
      setDocs(docRes.data.data || []);

      // Items a doctor has logged as used on a pet — shown alongside that pet's records so whoever hands items
      // over at pickup (pharmacist, inventory desk) sees the full bundle, not just the medicine text.
      const byPet = {};
      (txnRes.data.data || []).forEach((t) => {
        if (!t.pet_name) return;
        const key = t.pet_id;
        if (!byPet[key]) byPet[key] = [];
        byPet[key].push({ name: t.item_name, quantity: t.quantity, category: t.category });
      });
      setIssuedByPet(byPet);
    } catch (e) {
      console.error('Failed to load clinical records:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    try {
      const [petsRes, docRes] = await Promise.all([
        getPets({ limit: 200 }),
        isDoctor ? Promise.resolve({ data: { data: [] } }) : getDoctors({ limit: 50 })
      ]);
      setPets(petsRes.data.data || []);
      setDoctors(docRes.data.data || []);
    } catch (e) {
      console.error('Failed to load dropdown data:', e);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Only a role that can actually open a write modal (New Consultation / Write / Upload Prescription) needs the
    // pet and doctor pickers — a view-only role (e.g. the Pharmacy/Inventory desk) can't open any of them, and
    // doesn't hold PET_VIEW, so this would otherwise fail and clutter the console for no benefit.
    if (!isDoctor && !canManage) return;
    fetchDropdowns();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddRxRow = () => {
    setFormData(prev => ({
      ...prev,
      prescriptions: [
        ...prev.prescriptions,
        { medicine_name: '', dosage: '', frequency: 'Once daily', duration_days: 5, instructions: '' }
      ]
    }));
  };

  const handleRemoveRxRow = (index) => {
    setFormData(prev => ({
      ...prev,
      prescriptions: prev.prescriptions.filter((_, i) => i !== index)
    }));
  };

  const handleRxChange = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.prescriptions];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, prescriptions: updated };
    });
  };

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.pet_id || !formData.diagnosis) {
      setFormError('Patient (Pet) and Clinical Diagnosis are required.');
      return;
    }

    const validRx = formData.prescriptions.filter(r => r.medicine_name && r.dosage);

    setSaving(true);
    try {
      await createMedicalRecord({
        ...formData,
        prescriptions: validRx
      });
      showToast('Clinical Consultation & Prescriptions saved! 🩺');
      setShowAddModal(false);
      setFormData(initialForm);
      fetchAll();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save medical record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this clinical record?')) return;
    try {
      await deleteMedicalRecord(id);
      showToast('Record deleted.');
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete record');
    }
  };

  const openDoc = async (docId) => {
    try {
      const res = await getDocumentLink(docId);
      window.open(resolveDocumentUrl(res.data.data.path), '_blank', 'noopener');
    } catch (e) {
      showToast('Could not open the file');
    }
  };

  // The Rx Card is the one place pharmacy actually opens to check a patient's prescription, so a scanned/
  // photographed one needs to be visible right there too, not just as a link in the table row — fetch a
  // signed preview URL (image documents only; a PDF still opens via the button below) whenever the card opens.
  useEffect(() => {
    if (!showDetailModal || !selectedRecord) return;
    const imageDocs = docs.filter((d) => d.pet_id === selectedRecord.pet_id && (d.mime_type || '').startsWith('image/'));
    imageDocs.forEach((d) => {
      if (scannedPreviewUrls[d.id]) return;
      getDocumentLink(d.id)
        .then((res) => setScannedPreviewUrls((prev) => ({ ...prev, [d.id]: resolveDocumentUrl(res.data.data.path) })))
        .catch(() => {});
    });
  }, [showDetailModal, selectedRecord, docs]); // eslint-disable-line react-hooks/exhaustive-deps

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
              Clinical Records & Prescriptions
            </h1>
            <p style={{ color: 'var(--text-light)', fontSize: '14px', marginTop: '4px' }}>
              Examination findings, diagnoses, prescriptions, and the inventory issued alongside them
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {isDoctor && (
              <>
                <button onClick={() => setShowUploadModal(true)} style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--primary)', background: '#fff', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>📎 Upload Prescription</button>
                <button onClick={() => setShowWriteModal(true)} style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--primary)', background: '#fff', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>✍️ Write Prescription</button>
              </>
            )}
            {canManage && (
              <button
                onClick={() => { setFormData(initialForm); setFormError(''); setShowAddModal(true); }}
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                  color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px',
                  fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(27,175,191,0.35)'
                }}
              >
                <span>📝</span> New Clinical Consultation
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', marginBottom: '24px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by pet name, diagnosis, or doctor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Records Table */}
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '28px' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
              <div>Loading clinical consultations...</div>
            </div>
          ) : records.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🩺</div>
              <h3 style={{ color: 'var(--text-dark)', fontWeight: '700' }}>No Clinical Records Found</h3>
              <p style={{ fontSize: '14px', marginTop: '4px' }}>Record a new pet consultation to create the first entry.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid var(--border)', color: 'var(--text-medium)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '16px 20px' }}>Patient & Owner</th>
                    <th style={{ padding: '16px 20px' }}>Visit Date</th>
                    <th style={{ padding: '16px 20px' }}>Attending Doctor</th>
                    <th style={{ padding: '16px 20px' }}>Diagnosis & Symptoms</th>
                    <th style={{ padding: '16px 20px' }}>Prescriptions</th>
                    <th style={{ padding: '16px 20px' }}>Issued Items</th>
                    <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => {
                    const issued = issuedByPet[rec.pet_id] || [];
                    return (
                      <tr key={rec.id} style={{ borderBottom: '1px solid #edf2f7', transition: 'background 0.15s' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-dark)' }}>{rec.pet_name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                            {rec.pet_species} • Owner: {rec.owner_name}
                          </div>
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-dark)' }}>
                            {new Date(rec.visit_date).toLocaleDateString()}
                          </div>
                          {rec.weight_kg && (
                            <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{rec.weight_kg} kg</div>
                          )}
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-dark)' }}>{rec.doctor_name || 'Staff Doctor'}</div>
                          <div style={{ fontSize: '12px', color: 'var(--primary)' }}>{rec.doctor_specialization || 'General Vet'}</div>
                        </td>

                        <td style={{ padding: '16px 20px', maxWidth: '280px' }}>
                          <div style={{ fontWeight: '700', color: '#c53030', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{rec.diagnosis}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-medium)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rec.symptoms || rec.treatment_notes || (rec.is_prescription_note ? '' : 'Routine examination')}
                          </div>
                        </td>

                        <td style={{ padding: '16px 20px' }}>
                          {rec.prescriptions && rec.prescriptions.length > 0 ? (
                            <span style={{
                              padding: '4px 10px', borderRadius: '12px', background: '#ebf8ff',
                              color: '#2b6cb0', fontSize: '12px', fontWeight: '700'
                            }}>
                              💊 {rec.prescriptions.length} Meds
                            </span>
                          ) : rec.is_prescription_note ? (
                            <span style={{ padding: '4px 10px', borderRadius: '12px', background: '#ebf8ff', color: '#2b6cb0', fontSize: '12px', fontWeight: '700' }}>💊 Note</span>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>None</span>
                          )}
                        </td>

                        <td style={{ padding: '16px 20px', maxWidth: '220px' }}>
                          {issued.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {issued.map((it, i) => (
                                <span key={i} style={{ fontSize: '11.5px', color: 'var(--text-dark)' }}>📦 {it.quantity} × {it.name}</span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => { setSelectedRecord(rec); setShowDetailModal(true); }}
                              style={{
                                padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                                background: '#fff', color: 'var(--text-dark)', cursor: 'pointer', fontSize: '13px',
                                fontWeight: '600'
                              }}
                            >
                              View Rx Card
                            </button>
                            {canManage && (
                              <button
                                onClick={() => handleDelete(rec.id)}
                                style={{
                                  padding: '6px 10px', borderRadius: '8px', border: 'none',
                                  background: '#fed7d7', color: '#742a2a', cursor: 'pointer', fontSize: '13px',
                                  fontWeight: '600'
                                }}
                              >
                                ✕
                              </button>
                            )}
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

        {/* A prescription can be uploaded for a pet before any clinical record has been written for them, which
            would otherwise make it invisible now that it's no longer a separate list — this is the fallback for
            just that case, so nothing gets silently lost. Empty (and hidden) whenever every upload has a match. */}
        {docs.some((d) => !records.some((rec) => rec.pet_id === d.pet_id)) && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '800', color: 'var(--text-dark)' }}>
              📎 Uploaded prescriptions without a clinical record yet
            </div>
            <div className="card" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px', padding: '16px' }}>
                {docs.filter((d) => !records.some((rec) => rec.pet_id === d.pet_id)).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => openDoc(d.id)}
                    style={{ textAlign: 'left', padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: '#fff', cursor: 'pointer' }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--primary)' }}>📎 {d.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
                      {d.pet_name ? `${d.pet_name} • ` : ''}{d.customer_name ? `${d.customer_name} • ` : ''}{new Date(d.created_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal: New Clinical Consultation */}
        {showAddModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
          }}>
            <div className="modal-scroll" style={{
              background: '#fff', borderRadius: '20px', maxWidth: '750px', width: '100%',
              maxHeight: '90vh', overflowY: 'auto', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-dark)' }}>
                  New Clinical Consultation & Digital Rx
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}
                >
                  ✕
                </button>
              </div>

              {formError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{formError}</div>}

              <form onSubmit={handleCreateRecord}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label">Patient (Pet) *</label>
                    <select
                      className="form-input"
                      value={formData.pet_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, pet_id: e.target.value }))}
                      required
                    >
                      <option value="">Select Pet Patient</option>
                      {pets.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.species} - Owner: {p.owner_name || p.customer_name})</option>
                      ))}
                    </select>
                  </div>

                  {!isDoctor && (
                    <div>
                      <label className="form-label">Attending Doctor</label>
                      <select
                        className="form-input"
                        value={formData.doctor_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, doctor_id: e.target.value }))}
                      >
                        <option value="">Select Attending Specialist</option>
                        {doctors.map(d => (
                          <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label className="form-label">Visit Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.visit_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, visit_date: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="form-label">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      placeholder="e.g. 14.5"
                      value={formData.weight_kg}
                      onChange={(e) => setFormData(prev => ({ ...prev, weight_kg: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="form-label">Temperature (°F)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      placeholder="e.g. 101.5"
                      value={formData.temperature_f}
                      onChange={(e) => setFormData(prev => ({ ...prev, temperature_f: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Symptoms & Clinical Signs</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder="Describe reported symptoms and physical exam findings..."
                    value={formData.symptoms}
                    onChange={(e) => setFormData(prev => ({ ...prev, symptoms: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Diagnosis *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Canine Gastroenteritis, Feline Upper Respiratory Infection"
                    value={formData.diagnosis}
                    onChange={(e) => setFormData(prev => ({ ...prev, diagnosis: e.target.value }))}
                    required
                  />
                </div>


                <div className="form-group">
                  <label className="form-label">Treatment Plan & Medical Advice</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder="Dietary changes, rest requirements, wound care..."
                    value={formData.treatment_notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, treatment_notes: e.target.value }))}
                  />
                </div>

                {/* Prescriptions Section */}
                <div style={{ marginTop: '24px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-dark)' }}>
                      💊 Digital Prescriptions (Rx)
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddRxRow}
                      style={{
                        padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--primary)',
                        background: 'var(--primary-light)', color: 'var(--primary-dark)',
                        fontSize: '12px', fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      + Add Medication
                    </button>
                  </div>

                  {formData.prescriptions.map((rx, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', marginBottom: '10px', border: '1px solid #edf2f7' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Medicine</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Amoxicillin 250mg"
                            value={rx.medicine_name}
                            onChange={(e) => handleRxChange(idx, 'medicine_name', e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Dosage</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. 1 tab"
                            value={rx.dosage}
                            onChange={(e) => handleRxChange(idx, 'dosage', e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Frequency</label>
                          <select
                            className="form-input"
                            value={rx.frequency}
                            onChange={(e) => handleRxChange(idx, 'frequency', e.target.value)}
                          >
                            <option value="Once daily">Once daily</option>
                            <option value="Twice daily">Twice daily</option>
                            <option value="Thrice daily">Thrice daily</option>
                            <option value="As needed">As needed</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Duration (days)</label>
                          <input
                            type="number"
                            min="1"
                            className="form-input"
                            placeholder="Days"
                            title="How many days to give this medicine for"
                            value={rx.duration_days}
                            onChange={(e) => handleRxChange(idx, 'duration_days', e.target.value)}
                          />
                        </div>
                        {formData.prescriptions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRxRow(idx)}
                            title="Remove this medication"
                            style={{ background: 'none', border: 'none', color: '#e53e3e', fontSize: '18px', cursor: 'pointer', paddingBottom: '10px' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Instructions (e.g. Administer after meals with plenty of fresh water)"
                        style={{ marginTop: '8px', fontSize: '12px' }}
                        value={rx.instructions}
                        onChange={(e) => handleRxChange(idx, 'instructions', e.target.value)}
                      />
                    </div>
                  ))}
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
                    {saving ? 'Saving...' : 'Save Consultation Record'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: View Consultation & Prescription Card */}
        {showDetailModal && selectedRecord && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
          }}>
            <div className="modal-scroll" style={{
              background: '#fff', borderRadius: '20px', maxWidth: '680px', width: '100%',
              padding: '36px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--primary-light)', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '24px' }}>🐾</span>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary-dark)' }}>CADOVET CLINIC</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
                    Clinical Consultation & Prescription Slip
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}
                >
                  ✕
                </button>
              </div>

              {/* Patient & Doctor Banner */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Patient Info</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-dark)', marginTop: '2px' }}>{selectedRecord.pet_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-medium)' }}>
                    {selectedRecord.pet_species} • {selectedRecord.pet_breed || 'Breed N/A'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                    Owner: {selectedRecord.owner_name} ({selectedRecord.owner_mobile})
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: '700' }}>Consultation Details</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-dark)', marginTop: '2px' }}>
                    {new Date(selectedRecord.visit_date).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--primary-dark)', fontWeight: '600' }}>
                    Doctor: {selectedRecord.doctor_name || 'Attending Physician'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                    Weight: {selectedRecord.weight_kg ? `${selectedRecord.weight_kg} kg` : 'N/A'} • Temp: {selectedRecord.temperature_f ? `${selectedRecord.temperature_f} °F` : 'Normal'}
                  </div>
                </div>
              </div>

              {/* Clinical Assessment */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '4px' }}>
                  Clinical Diagnosis
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#c53030', background: '#fff5f5', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fed7d7', whiteSpace: 'pre-wrap' }}>
                  {selectedRecord.diagnosis}
                </div>
              </div>

              {selectedRecord.symptoms && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-medium)', marginBottom: '4px' }}>Reported Symptoms:</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-dark)', background: '#fff', border: '1px solid #edf2f7', padding: '10px 14px', borderRadius: '8px' }}>
                    {selectedRecord.symptoms}
                  </div>
                </div>
              )}

              {selectedRecord.treatment_notes && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-medium)', marginBottom: '4px' }}>Treatment Plan & Advice:</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-dark)', background: '#fff', border: '1px solid #edf2f7', padding: '10px 14px', borderRadius: '8px' }}>
                    {selectedRecord.treatment_notes}
                  </div>
                </div>
              )}

              {/* Prescriptions */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-dark)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>💊</span> Prescribed Medications
                </div>

                {selectedRecord.prescriptions && selectedRecord.prescriptions.length > 0 ? (
                  <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-medium)' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>Medicine</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>Dosage</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>Frequency</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRecord.prescriptions.map((rx, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #edf2f7' }}>
                            <td style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-dark)' }}>
                              {rx.medicine_name}
                              {rx.instructions && (
                                <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '400' }}>
                                  Note: {rx.instructions}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px' }}>{rx.dosage}</td>
                            <td style={{ padding: '10px 14px' }}>{rx.frequency}</td>
                            <td style={{ padding: '10px 14px' }}>{rx.duration_days} days</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', fontSize: '13px', color: 'var(--text-light)' }}>
                    No medications prescribed during this visit.
                  </div>
                )}
              </div>

              {/* Scanned/photographed prescription, if the doctor uploaded one for this pet — shown right here so
                  pharmacy sees it the moment they open the card, not only as a small link back in the table row. */}
              {docs.filter((d) => d.pet_id === selectedRecord.pet_id).length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-dark)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📎</span> Scanned / Photographed Prescription
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {docs.filter((d) => d.pet_id === selectedRecord.pet_id).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => openDoc(d.id)}
                        title={`Open ${d.title}`}
                        style={{
                          padding: 0, border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden',
                          background: '#fff', cursor: 'pointer', width: '150px', textAlign: 'left',
                        }}
                      >
                        {scannedPreviewUrls[d.id] ? (
                          <img src={scannedPreviewUrls[d.id]} alt={d.title} style={{ width: '150px', height: '110px', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{ width: '150px', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontSize: '30px' }}>
                            📄
                          </div>
                        )}
                        <div style={{ padding: '8px 10px', fontSize: '11.5px', fontWeight: '700', color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.title}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Issued Inventory Items */}
              {(issuedByPet[selectedRecord.pet_id] || []).length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-dark)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📦</span> Inventory Items Issued for {selectedRecord.pet_name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {issuedByPet[selectedRecord.pet_id].map((it, i) => (
                      <div key={i} style={{ fontSize: '13px', color: 'var(--text-dark)', background: '#f8fafc', padding: '8px 14px', borderRadius: '8px' }}>
                        {it.quantity} × {it.name} <span style={{ color: 'var(--text-light)', fontSize: '11.5px' }}>({it.category})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #edf2f7' }}>
                <button
                  onClick={() => setShowDetailModal(false)}
                  style={{
                    padding: '10px 24px', borderRadius: '10px', border: 'none',
                    background: 'var(--primary)', color: '#fff', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  Close Record
                </button>
              </div>
            </div>
          </div>
        )}

        {showWriteModal && (
          <WritePrescriptionModal
            pets={pets}
            onClose={() => setShowWriteModal(false)}
            onDone={() => { setShowWriteModal(false); showToast('Prescription sent to the patient and operational head 🩺'); fetchAll(); }}
          />
        )}
        {showUploadModal && (
          <UploadPrescriptionModal
            pets={pets}
            onClose={() => setShowUploadModal(false)}
            onDone={() => { setShowUploadModal(false); showToast('Prescription uploaded and sent 📎'); fetchAll(); }}
          />
        )}
      </div>
    </AdminLayout>
  );
};

export default MedicalRecordsPage;
