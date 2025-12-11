import { QueryClient } from '@tanstack/react-query';

const isTestEnv = process.env.JEST_WORKER_ID !== undefined;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      ...(isTestEnv ? { gcTime: 0 } : {}),
    },
    mutations: {
      ...(isTestEnv ? { gcTime: 0 } : {}),
    },
  },
});
