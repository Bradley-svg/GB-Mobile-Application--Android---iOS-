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
  completeTwoFactor: ReturnType<typeof vi.fn>;
};

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: undefined,
      refreshToken: undefined,
      user: null,
      sessionStartedAt: undefined,
      lastActiveAt: undefined,
      twoFactorSetupRequired: false,
      hasHydrated: true,
      forcedExpireReason: null,
      setTokens: useAuthStore.getState().setTokens,
      setUser: useAuthStore.getState().setUser,
      logout: useAuthStore.getState().logout,
      logoutAll: useAuthStore.getState().logoutAll,
      recordActivity: useAuthStore.getState().recordActivity,
      login: useAuthStore.getState().login,
      completeTwoFactor: useAuthStore.getState().completeTwoFactor,
      refresh: useAuthStore.getState().refresh,
      loadFromStorage: useAuthStore.getState().loadFromStorage,
      markSessionExpired: useAuthStore.getState().markSessionExpired,
      clearForcedExpire: useAuthStore.getState().clearForcedExpire,
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
    expect(state.sessionStartedAt).toBeDefined();
    expect(state.lastActiveAt).toBeDefined();
  });

  it("refreshes tokens when refresh token is present", async () => {
    useAuthStore.setState((prev) => ({
      ...prev,
      refreshToken: "refresh-abc",
      sessionStartedAt: 123,
      lastActiveAt: 123,
    }));
    mockedAuthApi.refresh.mockResolvedValue({ accessToken: "token-new", refreshToken: "refresh-new" });

    await act(async () => {
      await useAuthStore.getState().refresh();
    });

    const state = useAuthStore.getState();
    expect(mockedAuthApi.refresh).toHaveBeenCalledWith("refresh-abc");
    expect(state.accessToken).toBe("token-new");
    expect(state.refreshToken).toBe("refresh-new");
    expect(state.sessionStartedAt).toBe(123);
    expect(state.lastActiveAt).not.toBe(123);
  });

  it("clears state without reload when logoutAll is called", () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadSpy, href: "" },
      writable: true,
    });
    useAuthStore.setState((prev) => ({
      ...prev,
      accessToken: "token",
      refreshToken: "refresh",
      user: { id: "1", email: "demo@greenbro.com" },
      sessionStartedAt: 1,
      lastActiveAt: 2,
    }));

    useAuthStore.getState().logoutAll({ hardReload: false });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeUndefined();
    expect(state.refreshToken).toBeUndefined();
    expect(state.user).toBeNull();
    expect(state.sessionStartedAt).toBeUndefined();
    expect(state.lastActiveAt).toBeUndefined();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("tracks twoFactorSetupRequired flag from login response", async () => {
    mockedAuthApi.login.mockResolvedValue({
      accessToken: "token-123",
      refreshToken: "refresh-123",
      user: { id: "1", email: "demo@greenbro.com" },
      twoFactorSetupRequired: true,
    });

    await act(async () => {
      await useAuthStore.getState().login("demo@greenbro.com", "password123");
    });

    expect(useAuthStore.getState().twoFactorSetupRequired).toBe(true);
  });
});
