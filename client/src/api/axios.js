import axios from 'axios';
import { storage } from '../lib/storage';

export const IS_DEMO = import.meta.env.VITE_DEMO === 'true';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 60000,
  // Demo build: requests are served by an in-browser implementation of the same REST API
  ...(IS_DEMO && { adapter: async (config) => (await import('./mock/server.js')).handle(config) }),
});

API.interceptors.request.use((config) => {
  const token = storage.get('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLogin = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLogin) {
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(error);
  }
);

export default API;
