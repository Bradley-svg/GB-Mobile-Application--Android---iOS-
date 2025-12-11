import axios from "axios";
import { WEB_API_BASE_URL } from "@/config/env";
import { getTokens, setTokensFromRefresh } from "./tokenStore";
import type { AuthTokens } from "@/lib/types/auth";

type RefreshableRequestConfig = {
  _retry?: boolean;
  headers?: Record<string, string>;
};

const baseURL = process.env.NEXT_PUBLIC_API_URL || WEB_API_BASE_URL;

const api = axios.create({
  baseURL,
});

const refreshClient = axios.create({
  baseURL,
});

let isRefreshing = false;
let refreshPromise: Promise<AuthTokens | null> | null = null;

const attachToken = (token?: string) => (token ? { Authorization: `Bearer ${token}` } : {});

api.interceptors.request.use((config) => {
  const { accessToken } = getTokens();
  if (accessToken && config.headers) {
    config.headers = { ...config.headers, ...attachToken(accessToken) };
  }
  return config;
});

async function performRefresh(): Promise<AuthTokens | null> {
  const { refreshToken } = getTokens();
  if (!refreshToken) return null;

  const payload = { refreshToken };
  const res = await refreshClient.post<AuthTokens>("/auth/refresh", payload);
  return res.data;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    const originalRequest = config as typeof config & RefreshableRequestConfig;
    if (!response || response.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = performRefresh()
        .then((tokens) => {
          if (tokens?.accessToken && tokens?.refreshToken) {
            setTokensFromRefresh(tokens);
            return tokens;
          }
          setTokensFromRefresh(null);
          return null;
        })
        .finally(() => {
          isRefreshing = false;
        });
    }

    try {
      const tokens = await refreshPromise;
      if (tokens?.accessToken) {
        originalRequest.headers = { ...(originalRequest.headers || {}), ...attachToken(tokens.accessToken) };
        return api(originalRequest);
      }
    } catch (err) {
      return Promise.reject(err);
    }

    return Promise.reject(error);
  },
);

export { api };
