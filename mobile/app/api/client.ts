import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';

type ExpoExtra = {
  apiUrl?: string;
  useSignedFileUrls?: boolean | string;
};

const rawUseSignedFileUrls =
  (Constants.expoConfig?.extra as ExpoExtra | undefined)?.useSignedFileUrls ??
  process.env.EXPO_PUBLIC_USE_SIGNED_FILE_URLS;
const useSignedFileUrls =
  typeof rawUseSignedFileUrls === 'string'
    ? rawUseSignedFileUrls.toLowerCase() === 'true'
    : Boolean(rawUseSignedFileUrls);

const apiUrl =
  (Constants.expoConfig?.extra as ExpoExtra | undefined)?.apiUrl ?? 'http://10.0.2.2:4000';

console.log('Greenbro API base URL at runtime:', apiUrl);

export const api = axios.create({
  baseURL: apiUrl,
});
export const API_BASE_URL = apiUrl;
export const USE_SIGNED_FILE_URLS = useSignedFileUrls;
export function shouldUseSignedFileUrls() {
  return USE_SIGNED_FILE_URLS;
}

type RetriableRequestConfig = AxiosRequestConfig & { _retry?: boolean };
type AuthTokens = { accessToken: string; refreshToken: string };

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const { response, config } = error;
    const originalRequest = config as RetriableRequestConfig;

    if (!response) {
      return Promise.reject(error);
    }

    const isUnauthorized = response.status === 401;
    const isRefreshRequest = originalRequest.url?.includes('/auth/refresh');
    if (!isUnauthorized || originalRequest._retry || isRefreshRequest) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const { refreshToken, updateTokens, clearAuth, setSessionExpired } = useAuthStore.getState();

    if (!refreshToken) {
      await clearAuth();
      setSessionExpired(true);
      return Promise.reject(error);
    }

    try {
      const refreshRes = await api.post<AuthTokens>('/auth/refresh', { refreshToken });
      const tokens = refreshRes.data;
      if (!tokens?.accessToken || !tokens?.refreshToken) {
        throw new Error('Invalid refresh response');
      }
      // TODO: surface a 2FA challenge flow here when backend signals it is required.
      await updateTokens(tokens);
      return api(originalRequest);
    } catch (refreshError) {
      await clearAuth();
      const refreshStatus = axios.isAxiosError(refreshError)
        ? refreshError.response?.status
        : undefined;
      if (refreshStatus === 401 || refreshStatus === 400) {
        setSessionExpired(true);
      }
      return Promise.reject(refreshError);
    }
  }
);
