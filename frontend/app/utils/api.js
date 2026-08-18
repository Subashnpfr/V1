import axios from 'axios';

/** Same-origin proxy in dev (see next.config.js rewrites). Override with NEXT_PUBLIC_API_BASE if needed. */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/backend';

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (!path.startsWith('/login') && !path.startsWith('/register')) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    return Promise.reject(err);
  }
);
