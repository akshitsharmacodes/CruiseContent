/**
 * Centralised API base URL.
 *
 * In development: http://localhost:8000  (Vite dev server default)
 * In production:  set VITE_API_BASE_URL=https://your-render-service.onrender.com
 *                 in the Vercel project environment variables.
 *
 * Never hardcode localhost here — always read from the Vite env var.
 */

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

/**
 * Build a full API endpoint URL.
 * @param {string} path - Path relative to /api/ (e.g. 'auth/login/')
 * @returns {string}
 */
export const apiUrl = (path) => `${API_BASE_URL}/api/${path.replace(/^\//, '')}`;

/**
 * Build a media/asset URL for files served from the backend.
 * In production, Cloudinary handles media files so the URL returned by the
 * server is already absolute. For dev, prefix with the backend base URL.
 *
 * @param {string|null|undefined} path - e.g. '/media/generated_images/foo.jpg'
 * @returns {string}
 */
export const getMediaUrl = (path) => {
  if (!path) return '';
  // If already absolute (Cloudinary, S3, etc.) return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path}`;
};
