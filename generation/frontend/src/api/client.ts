import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('generation_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (typeof data?.error === 'string') return data.error;
    if (data?.error?.formErrors?.length) return data.error.formErrors.join(', ');
    if (data?.error?.fieldErrors) {
      const first = Object.values(data.error.fieldErrors)[0];
      if (Array.isArray(first) && first.length) return String(first[0]);
    }
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}
