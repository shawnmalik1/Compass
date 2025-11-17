import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ACCESS_TOKEN = import.meta.env.VITE_COMPASS_TOKEN || '';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: ACCESS_TOKEN ? { 'X-Compass-Key': ACCESS_TOKEN } : undefined,
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.message ||
      'Request to backend failed';
    return Promise.reject(new Error(message));
  },
);

export { API_BASE_URL, client };
