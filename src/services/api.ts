import axios from 'axios';
import type { Case, User, AuthResponse, LesionImage } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dermai_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('dermai_token');
      localStorage.removeItem('dermai_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/login', { email, password });
    return res.data;
  },
  register: async (data: { email: string; password: string; full_name: string; role: string }): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/register', data);
    return res.data;
  },
  getMe: async (): Promise<User> => {
    const res = await api.get<User>('/users/me');
    return res.data;
  },
};

export const casesApi = {
  list: async (params?: { status?: string; body_location?: string }): Promise<Case[]> => {
    const res = await api.get<Case[]>('/cases', { params });
    return res.data;
  },
  get: async (id: number): Promise<Case> => {
    const res = await api.get<Case>(`/cases/${id}`);
    return res.data;
  },
  create: async (data: {
    title: string;
    body_location: string;
    patient_age?: number;
    patient_gender?: string;
    medical_history?: string;
    clinical_notes?: string;
  }): Promise<Case> => {
    const res = await api.post<Case>('/cases', data);
    return res.data;
  },
  update: async (id: number, data: { title?: string; body_location?: string; status?: string }): Promise<Case> => {
    const res = await api.put<Case>(`/cases/${id}`, data);
    return res.data;
  },
  addNotes: async (id: number, notes: string): Promise<Case> => {
    const res = await api.post<Case>(`/cases/${id}/notes`, { notes });
    return res.data;
  },
  uploadImage: async (caseId: number, file: File, source: 'camera' | 'gallery' = 'camera', force: boolean = false): Promise<LesionImage> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source', source);
    formData.append('force', String(force));

    const res = await api.post<LesionImage>(`/cases/${caseId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getImages: async (caseId: number): Promise<LesionImage[]> => {
    const res = await api.get<LesionImage[]>(`/cases/${caseId}/images`);
    return res.data;
  },
};

export const systemApi = {
  getHealth: async () => {
    const res = await api.get('/health');
    return res.data;
  },
};

export default api;
