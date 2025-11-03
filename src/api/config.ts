// src/api/config.ts
export const API_BASE = 'http://localhost:8000/api';
export const api = (path: string) =>
  `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
