import { useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';

const useApi = () => {
  const { accessToken, refreshAccessToken, logout } = useAuth();

  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: `${API_BASE_URL}/api/`,
      withCredentials: true, // Supports HttpOnly refresh cookie
      headers: {
        'Content-Type': 'application/json',
      },
    });

    instance.interceptors.request.use((config) => {
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      // Normalize URL: prevent duplicate /api/ in requests
      if (config.url) {
        if (config.url.startsWith('/api/')) {
          config.url = config.url.substring(5);
        } else if (config.url.startsWith('api/')) {
          config.url = config.url.substring(4);
        } else if (config.url.startsWith('/')) {
          config.url = config.url.substring(1);
        }
      }

      return config;
    });

    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        const requestUrl = originalRequest?.url || '';

        // NEVER attempt refresh for authentication bootstrap endpoints to avoid masking real errors
        const isAuthEndpoint = (
          requestUrl.includes('auth/login') ||
          requestUrl.includes('auth/signup') ||
          requestUrl.includes('token/refresh') ||
          requestUrl.includes('auth/logout') ||
          requestUrl.includes('google/login') ||
          requestUrl.includes('google/callback')
        );

        if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
          const hasSession = typeof window !== 'undefined' && localStorage.getItem('cc_has_session') === 'true';
          if (hasSession && refreshAccessToken) {
            originalRequest._retry = true;
            try {
              const newAccessToken = await refreshAccessToken();
              if (newAccessToken) {
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return instance(originalRequest);
              }
            } catch (refreshErr) {
              logout();
              return Promise.reject(refreshErr);
            }
          }
        }

        return Promise.reject(error);
      }
    );

    return instance;
  }, [accessToken, refreshAccessToken, logout]);

  return api;
};

export default useApi;
