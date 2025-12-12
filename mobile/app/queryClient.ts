import { QueryClient } from '@tanstack/react-query';

const isTestEnv = process.env.JEST_WORKER_ID !== undefined;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: isTestEnv ? 0 : 30_000,
      gcTime: isTestEnv ? 0 : 5 * 60 * 1000,
    },
    mutations: {
      ...(isTestEnv ? { gcTime: 0 } : {}),
    },
  },
});
