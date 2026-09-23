import axios, { AxiosInstance } from 'axios';

// Module-level singleton: created ONCE per process lifetime.
// This prevents interceptor stacking on Next.js HMR or re-imports.
let _api: AxiosInstance | null = null;

function getApi(): AxiosInstance {
  if (_api) return _api;

  _api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
    headers: { 'Content-Type': 'application/json' },
  });

  // Attach JWT token — added exactly once
  _api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('admin_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  });

  return _api;
}

const api = getApi();
export default api;
