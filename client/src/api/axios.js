import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('whisprlive_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response &&
      (error.response.status === 401 ||
        (error.response.status === 403 && error.response.data?.error?.includes('Token')))
    ) {
      localStorage.removeItem('whisprlive_token');
      localStorage.removeItem('whisprlive_user');
    }
    return Promise.reject(error);
  }
);

export default API;
