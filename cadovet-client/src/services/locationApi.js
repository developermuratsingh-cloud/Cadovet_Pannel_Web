import api from './api';

export const getLocations = (params) => api.get('/locations', { params });
export const getMyLocations = () => api.get('/locations', { params: { mine: true } });
export const getPublicLocations = () => api.get('/locations/public');
export const createLocation = (data) => api.post('/locations', data);
export const updateLocation = (id, data) => api.put(`/locations/${id}`, data);
export const toggleLocationStatus = (id) => api.patch(`/locations/${id}/status`);
export const getLocationStaff = (id) => api.get(`/locations/${id}/staff`);
export const setActiveLocation = (locationId) => api.patch('/auth/active-location', { location_id: locationId });
