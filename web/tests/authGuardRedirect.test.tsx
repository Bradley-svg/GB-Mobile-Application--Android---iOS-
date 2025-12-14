import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppLayout from "@/app/app/layout";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { useAuthStore } from "@/lib/authStore";

const replaceMock = vi.hoisted(() => vi.fn());
const meMock = vi.hoisted(() => vi.fn());
const logoutAllMock = vi.hoisted(() => vi.fn());
const loadFromStorageMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ui", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...rest }: { children: ReactNode }) => <button {...rest}>{children}</button>,
}));

vi.mock("@/lib/useEmbed", () => ({
  useEmbed: () => ({ embedActive: false, appendEmbedParam: (href: string) => href, embedFromQuery: false }),
}));

vi.mock("@/lib/useSessionTimeout", () => ({
  useSessionTimeout: () => null,
}));

const loadOrgsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/orgStore", () => {
  const storeState = {
    currentOrgId: null,
    orgs: [] as Array<{ id: string; name: string }>,
    loading: false,
    setOrg: vi.fn(),
    setOrgs: vi.fn(),
    loadOrgs: loadOrgsMock,
  };
  const hook = (selector?: (state: typeof storeState) => unknown) => (selector ? selector(storeState) : storeState);
  hook.persist = { clearStorage: vi.fn() };
  hook.setState = vi.fn();
  return {
    useOrgStore: hook,
    useOrgRoleAwareLoader: () => loadOrgsMock,
  };
});

vi.mock("@/lib/useOrgSwitcher", () => ({
  useOrgSwitcher: () => ({ currentOrgId: null, orgs: [], switchOrg: vi.fn(), resetOrgQueries: vi.fn() }),
}));

vi.mock("@/lib/useUserRole", () => ({
  useUserRole: () => ({ isAdmin: false, isOwner: false, isFacilities: false, role: "" }),
}));

vi.mock("@/lib/api/authApi", () => ({
  me: (...args: unknown[]) => meMock(...args),
}));

const renderWithProviders = (ui: ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
};

describe("App layout auth guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meMock.mockRejectedValue({ response: { status: 401 } });
    loadFromStorageMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(null);
    logoutAllMock.mockImplementation(() => {});
    window.history.pushState({}, "", "http://localhost:3000/app");

    const state = useAuthStore.getState();
    useAuthStore.setState({
      ...state,
      accessToken: undefined,
      refreshToken: undefined,
      user: null,
      forcedExpireReason: null,
      hasHydrated: true,
      loadFromStorage: loadFromStorageMock,
      logoutAll: logoutAllMock,
      refresh: refreshMock,
      recordActivity: vi.fn(),
      setUser: vi.fn(),
    });
  });

  it("redirects unauthenticated users from /app to /login and calls /auth/me", async () => {
    renderWithProviders(
      <AppLayout>
        <div>child</div>
      </AppLayout>,
    );

    await waitFor(() => expect(meMock).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith("/login?returnTo=%2Fapp");
    expect(logoutAllMock).toHaveBeenCalled();
  });

  it("marks API unreachable when /auth/me fails without a response", async () => {
    meMock.mockRejectedValueOnce(new Error("network down"));

    renderWithProviders(
      <AppLayout>
        <div>child</div>
      </AppLayout>,
    );

    await waitFor(() => expect(meMock).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith("/login?returnTo=%2Fapp&reason=api_unreachable");
  });
});
