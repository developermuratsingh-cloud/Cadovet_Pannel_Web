import api from './api';

export const getRoles = () => api.get('/roles');
export const getRole = (id) => api.get(`/roles/${id}`);
export const createRole = (data) => api.post('/roles', data);
export const assignPermissions = (roleId, permission_ids) => api.put(`/roles/${roleId}/permissions`, { permission_ids });

export const getPermissions = () => api.get('/permissions');
export const getDepartments = () => api.get('/permissions/departments');

export const getAuditLogs = (params) => api.get('/audit-logs', { params });
