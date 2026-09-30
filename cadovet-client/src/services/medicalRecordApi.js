import api from './api';

export const getMedicalRecords = (params) => api.get('/medical-records', { params });
export const getMedicalRecord = (id) => api.get(`/medical-records/${id}`);
export const createMedicalRecord = (data) => api.post('/medical-records', data);
export const updateMedicalRecord = (id, data) => api.put(`/medical-records/${id}`, data);
export const deleteMedicalRecord = (id) => api.delete(`/medical-records/${id}`);
