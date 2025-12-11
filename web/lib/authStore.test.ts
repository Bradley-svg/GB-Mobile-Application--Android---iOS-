import { act } from "@testing-library/react";
import { vi } from "vitest";
import { useAuthStore } from "./authStore";
import * as authApi from "./api/authApi";

vi.mock("./api/authApi", async () => {
  const actual = await vi.importActual<typeof import("./api/authApi")>("./api/authApi");
  return {
    ...actual,
    login: vi.fn(),
    refresh: vi.fn(),
    completeTwoFactor: vi.fn(),
  };
});

const mockedAuthApi = authApi as unknown as {
  login: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
};

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: undefined,
      refreshToken: undefined,
      user: null,
      hasHydrated: true,
      setTokens: useAuthStore.getState().setTokens,
      setUser: useAuthStore.getState().setUser,
      logout: useAuthStore.getState().logout,
      login: useAuthStore.getState().login,
      completeTwoFactor: useAuthStore.getState().completeTwoFactor,
      refresh: useAuthStore.getState().refresh,
      loadFromStorage: useAuthStore.getState().loadFromStorage,
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("stores tokens and user after login", async () => {
    mockedAuthApi.login.mockResolvedValue({
      accessToken: "token-123",
      refreshToken: "refresh-123",
      user: { id: "1", email: "demo@greenbro.com" },
    });

    await act(async () => {
      await useAuthStore.getState().login("demo@greenbro.com", "password123");
    });

    const state = useAuthStore.getState();
    expect(mockedAuthApi.login).toHaveBeenCalledWith("demo@greenbro.com", "password123", undefined);
    expect(state.accessToken).toBe("token-123");
    expect(state.refreshToken).toBe("refresh-123");
    expect(state.user?.email).toBe("demo@greenbro.com");
  });

  it("refreshes tokens when refresh token is present", async () => {
    useAuthStore.setState((prev) => ({ ...prev, refreshToken: "refresh-abc" }));
    mockedAuthApi.refresh.mockResolvedValue({ accessToken: "token-new", refreshToken: "refresh-new" });

    await act(async () => {
      await useAuthStore.getState().refresh();
    });

    const state = useAuthStore.getState();
    expect(mockedAuthApi.refresh).toHaveBeenCalledWith("refresh-abc");
    expect(state.accessToken).toBe("token-new");
    expect(state.refreshToken).toBe("refresh-new");
  });
});
