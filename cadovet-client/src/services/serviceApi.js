import api from './api';

export const getServices = (params) => api.get('/services', { params });
export const getService = (id) => api.get(`/services/${id}`);
export const createService = (data) => api.post('/services', data);
export const updateService = (id, data) => api.put(`/services/${id}`, data);
// "Delete" is really a deactivate — a service is referenced by past appointments/invoices (ON DELETE NO ACTION),
// so a real DELETE would fail once it's ever been booked. There is no DELETE /services/:id route.
export const deleteService = (id) => api.put(`/services/${id}`, { is_active: false });
// Uploads an image file from the operational head/admin's device and returns its public URL, to be put
// straight into a service's image_url — the same field a pasted URL would set.
export const uploadServiceImage = (file) => {
  const form = new FormData();
  form.append('image', file);
  return api.post('/services/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
