// src/api/config.ts
// Use relative URL in development (Vite proxy handles it)
// In production, this would be your actual API URL
export const API_BASE = '/api';
export const api = (path: string) =>
  `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
