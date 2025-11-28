import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';

type ExpoExtra = {
  apiUrl?: string;
};

const apiUrl = (Constants.expoConfig?.extra as ExpoExtra | undefined)?.apiUrl;

export const api = axios.create({
  baseURL: apiUrl,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
