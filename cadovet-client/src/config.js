// Single place for the API address. Set VITE_API_URL at build time for staging / production
// (e.g. VITE_API_URL=https://api.cadovet.com/api npm run build); local development falls back to the dev backend.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/$/, '');
