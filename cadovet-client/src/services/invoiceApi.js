import api from './api';

export const getInvoices = (params) => api.get('/invoices', { params });
export const getInvoice = (id) => api.get(`/invoices/${id}`);
export const createInvoice = (data) => api.post('/invoices', data);
export const updateInvoiceStatus = (id, data) => api.patch(`/invoices/${id}/status`, data);
export const deleteInvoice = (id) => api.delete(`/invoices/${id}`);
