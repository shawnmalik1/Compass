import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
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
