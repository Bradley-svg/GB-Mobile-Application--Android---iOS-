import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setTokensFromRefresh } from "@/lib/api/tokenStore";
import { useAuthStore } from "@/lib/authStore";

describe("refresh failure handling", () => {
  const originalLocation = window.location;
  const reloadSpy = vi.fn();
  Object.defineProperty(window, "location", {
    value: { ...originalLocation, reload: reloadSpy },
    writable: true,
  });
  afterAll(() => Object.defineProperty(window, "location", { value: originalLocation }));

  beforeEach(() => {
    useAuthStore.setState((state) => ({
      ...state,
      accessToken: "old-at",
      refreshToken: "old-rt",
      user: { id: "user-1", email: "demo@greenbro.com", organisation_id: "org-1" },
      sessionStartedAt: 123,
      lastActiveAt: 456,
      forcedExpireReason: null,
      hasHydrated: true,
    }));
    reloadSpy.mockClear();
  });

  it("marks the session as expired when refresh rotation fails", () => {
    setTokensFromRefresh(null, "refresh-error");

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeUndefined();
    expect(state.refreshToken).toBeUndefined();
    expect(state.user).toBeNull();
    expect(state.forcedExpireReason).toBe("refresh");
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
