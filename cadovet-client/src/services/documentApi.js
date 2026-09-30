import api from './api';
import { API_URL } from '../config';

export const getDocuments = (params) => api.get('/documents', { params });
// FormData: let the browser set the multipart boundary itself (the instance default forces JSON otherwise).
export const uploadDocument = (formData) => api.post('/documents', formData, { headers: { 'Content-Type': undefined } });
export const getDocumentLink = (id) => api.get(`/documents/${id}/link`);
export const deleteDocument = (id) => api.delete(`/documents/${id}`);

// getDocumentLink() returns a server-relative path (e.g. "/api/documents/5/file?token=..."); the API base already
// includes "/api", so resolve against its origin to avoid doubling that prefix.
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');
export const resolveDocumentUrl = (path) => `${API_ORIGIN}${path}`;
