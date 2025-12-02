import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';

const originalAdapter = api.defaults.adapter;

const makeResponse = <T = unknown>(
  config: InternalAxiosRequestConfig,
  data: T,
  status = 200
): AxiosResponse<T> => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config,
});

const unauthorizedError = (config: InternalAxiosRequestConfig) =>
  new AxiosError('Unauthorized', undefined, config, {}, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
    data: {},
  });

describe('api client refresh interceptor', () => {
  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      isHydrated: true,
    });
  });

  it('retries once after a refresh and keeps auth state', async () => {
    let callCount = 0;
    api.defaults.adapter = async (config) => {
      callCount += 1;

      if (config.url === '/auth/refresh') {
        return makeResponse(config, { accessToken: 'new-access', refreshToken: 'new-refresh' });
      }

      if (callCount === 1) {
        throw unauthorizedError(config);
      }

      return makeResponse(config, { ok: true });
    };

    useAuthStore.setState({
      accessToken: 'old-access',
      refreshToken: 'refresh-token',
      user: { id: 'user-1', email: 'user@test.com', name: 'Test User', organisation_id: null },
      isHydrated: true,
    });

    const res = await api.get('/sites');

    expect(res.data).toEqual({ ok: true });
    expect(useAuthStore.getState().accessToken).toBe('new-access');
    expect(useAuthStore.getState().refreshToken).toBe('new-refresh');
  });

  it('clears auth when refresh fails', async () => {
    api.defaults.adapter = async (config) => {
      if (config.url === '/auth/refresh') {
        throw unauthorizedError(config);
      }
      throw unauthorizedError(config);
    };

    useAuthStore.setState({
      accessToken: 'old-access',
      refreshToken: 'refresh-token',
      user: { id: 'user-2', email: 'user2@test.com', name: 'Another User', organisation_id: null },
      isHydrated: true,
    });

    await expect(api.get('/sites')).rejects.toBeInstanceOf(Error);

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
