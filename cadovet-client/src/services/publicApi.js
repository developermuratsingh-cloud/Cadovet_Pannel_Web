import axios from 'axios';
import { API_URL } from '../config';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

export const fetchPublicServices = async () => {
  const response = await api.get('/services/public');
  return response.data?.data || [];
};

export const fetchPublicServicesByCategory = async (category) => {
  const response = await api.get('/services/public', { params: { category } });
  return response.data?.data || [];
};

export const fetchPublicDoctors = async () => {
  const response = await api.get('/doctors/public');
  return response.data?.data || [];
};
