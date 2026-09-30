import api from './api';

export const getAppointments = (params) => api.get('/appointments', { params });
export const getAppointment = (id) => api.get(`/appointments/${id}`);
// Staff booking for a customer who phoned in. Without doctor_id the request waits in the operational head's queue.
export const createAppointment = (data) => api.post('/appointments', data);
// One form for a phone call: finds or creates the pet parent + pet, then books a real slot (outcome: 'BOOKED')
// or saves the call as declined (outcome: 'DECLINED') — the pet parent/pet are saved either way.
export const callIntake = (data) => api.post('/appointments/call-intake', data);
export const updateAppointment = (id, data) => api.put(`/appointments/${id}`, data);
export const updateAppointmentStatus = (id, data) => api.patch(`/appointments/${id}/status`, data);
export const cancelAppointment = (id) => api.patch(`/appointments/${id}/cancel`);
// Operational head / admin: give the request to a doctor (optionally moving it to a free slot of that doctor).
export const assignAppointment = (id, data) => api.patch(`/appointments/${id}/assign`, data);
// Without doctorId: the clinic's slots (what customers choose from). With doctorId: that doctor's own free slots.
export const getAvailability = ({ date, doctorId }) => api.get('/appointments/availability', { params: { date, ...(doctorId ? { doctor_id: doctorId } : {}) } });
