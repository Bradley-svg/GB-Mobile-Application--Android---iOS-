import axios, {
  AxiosHeaders,
  type AxiosRequestHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import { WEB_API_BASE_URL } from "@/config/env";
import { getTokens, setTokensFromRefresh } from "./tokenStore";
import type { AuthTokens } from "@/lib/types/auth";

type RefreshableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
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

const attachToken = (token?: string): Partial<AxiosRequestHeaders> => (token ? { Authorization: `Bearer ${token}` } : {});

api.interceptors.request.use((config) => {
  const { accessToken } = getTokens();
  if (accessToken) {
    const mergedHeaders = AxiosHeaders.from({
      ...(config.headers || {}),
      ...attachToken(accessToken),
    });
    config.headers = mergedHeaders;
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
    const originalRequest = config as RefreshableRequestConfig;
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
          setTokensFromRefresh(null, "refresh-error");
          return null;
        })
        .catch((err) => {
          if (axios.isAxiosError(err)) {
            const status = err.response?.status ?? 0;
            if (status === 401 || status === 403) {
              setTokensFromRefresh(null, "refresh-error");
              return null;
            }
          }
          return null;
        })
        .finally(() => {
          isRefreshing = false;
        });
    }

    try {
      const tokens = await refreshPromise;
      if (tokens?.accessToken) {
        originalRequest.headers = AxiosHeaders.from({
          ...(originalRequest.headers || {}),
          ...attachToken(tokens.accessToken),
        }) as AxiosRequestHeaders;
        return api(originalRequest);
      }
    } catch (err) {
      return Promise.reject(err);
    }

    return Promise.reject(error);
  },
);

export { api };
