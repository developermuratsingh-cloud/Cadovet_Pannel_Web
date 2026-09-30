import api from './api';

export const getDoctors = (params) => api.get('/doctors', { params });
export const getDoctor = (id) => api.get(`/doctors/${id}`);
export const createDoctor = (data) => api.post('/doctors', data);
export const updateDoctor = (id, data) => api.put(`/doctors/${id}`, data);
// No DELETE /doctors/:id on the backend (and no UI calls this) — a doctor with appointment/medical-record history
// can't be hard-deleted safely; deactivate via updateDoctor({ status: 'INACTIVE' }) instead.
