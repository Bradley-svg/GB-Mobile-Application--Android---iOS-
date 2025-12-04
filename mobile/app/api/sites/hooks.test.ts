import { useQuery } from '@tanstack/react-query';
import { useSites } from './hooks';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

describe('useSites retry config', () => {
  it('applies retry/backoff and skips retries on 4xx', () => {
    const mockReturn = { data: [], isLoading: false };
    let receivedOptions: {
      retry: (failureCount: number, error: unknown) => boolean;
      retryDelay: (attempt: number) => number;
    };
    (useQuery as jest.Mock).mockImplementation((options) => {
      receivedOptions = options;
      return mockReturn;
    });

    useSites();

    expect(receivedOptions.retryDelay(2)).toBe(2000);

    const serverError = { isAxiosError: true, response: { status: 500 } };
    expect(receivedOptions.retry(1, serverError)).toBe(true);

    const clientError = { isAxiosError: true, response: { status: 404 } };
    expect(receivedOptions.retry(1, clientError)).toBe(false);

    expect(receivedOptions.retry(3, serverError)).toBe(false);
  });
});
