import api from './api';

export const getInventory = (params) => api.get('/inventory', { params });
export const getInventoryItem = (id) => api.get(`/inventory/${id}`);
export const createInventoryItem = (data) => api.post('/inventory', data);
export const updateInventoryItem = (id, data) => api.put(`/inventory/${id}`, data);
export const adjustStock = (id, delta) => api.patch(`/inventory/${id}/adjust-stock`, { delta });
export const deleteInventoryItem = (id) => api.delete(`/inventory/${id}`);
export const dispenseToDoctor = (id, data) => api.post(`/inventory/${id}/dispense`, data);
// Named to avoid the `use*` prefix, which the react-hooks lint rule mistakes for an actual Hook.
export const recordMedicineUsage = (id, data) => api.post(`/inventory/${id}/use`, data);
export const getInventoryTransactions = (params) => api.get('/inventory/transactions', { params });
// Uploads a photo of a physical medicine slip and returns its URL, to pass as slip_image_url when dispensing.
export const uploadSlipImage = (file) => {
  const form = new FormData();
  form.append('image', file);
  return api.post('/inventory/upload-slip-image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};

// Report-an-issue workflow: doctor raises it, operational head verifies (forward/dismiss), the desk resolves it.
export const raiseDispute = (transactionId, data) => api.post(`/inventory/transactions/${transactionId}/dispute`, data);
export const getDisputes = (params) => api.get('/inventory/disputes', { params });
export const forwardDispute = (id, data) => api.patch(`/inventory/disputes/${id}/forward`, data);
export const dismissDispute = (id, data) => api.patch(`/inventory/disputes/${id}/dismiss`, data);
export const resolveDispute = (id, data) => api.patch(`/inventory/disputes/${id}/resolve`, data);
