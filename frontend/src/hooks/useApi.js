import { useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const useApi = () => {
  const { accessToken } = useAuth();

  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: 'http://localhost:8000/api/',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    instance.interceptors.request.use((config) => {
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
      return config;
    });

    return instance;
  }, [accessToken]);

  return api;
};

export default useApi;
