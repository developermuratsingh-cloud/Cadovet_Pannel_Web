import api from './api';

export const getUsers = (params) => api.get('/users', { params });
export const getUser = (id) => api.get(`/users/${id}`);
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
// Sets a new temporary password for a staff member; they must change it at next sign-in.
export const resetUserPassword = (id, password) => api.post(`/users/${id}/reset-password`, { password });
export const toggleUserStatus = (id) => api.patch(`/users/${id}/status`);
