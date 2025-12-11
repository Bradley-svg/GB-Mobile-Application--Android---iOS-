import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfilePage from "@/app/app/profile/page";
import { useAuthStore } from "@/lib/authStore";
import { ThemeProvider } from "@/theme/ThemeProvider";

const setupTwoFactorMock = vi.fn();
const confirmTwoFactorMock = vi.fn();
const disableTwoFactorMock = vi.fn();
const listAuthSessionsMock = vi.fn();
const revokeAuthSessionMock = vi.fn();
const revokeOtherAuthSessionsMock = vi.fn();
const toDataURLMock = vi.fn();

vi.mock("qrcode", () => ({
  default: {
    toDataURL: (...args: unknown[]) => toDataURLMock(...args),
  },
}));

vi.mock("@/lib/api/authApi", () => ({
  setupTwoFactor: (...args: unknown[]) => setupTwoFactorMock(...args),
  confirmTwoFactor: (...args: unknown[]) => confirmTwoFactorMock(...args),
  disableTwoFactor: (...args: unknown[]) => disableTwoFactorMock(...args),
  listAuthSessions: (...args: unknown[]) => listAuthSessionsMock(...args),
  revokeAuthSession: (...args: unknown[]) => revokeAuthSessionMock(...args),
  revokeOtherAuthSessions: (...args: unknown[]) => revokeOtherAuthSessionsMock(...args),
}));

const renderWithTheme = async () => {
  const view = render(
    <ThemeProvider>
      <ProfilePage />
    </ThemeProvider>,
  );
  await waitFor(() => expect(listAuthSessionsMock).toHaveBeenCalled());
  return view;
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_AUTH_2FA_ENFORCE_ROLES = "";
  setupTwoFactorMock.mockResolvedValue({
    secret: "SECRET-123",
    otpauthUrl: "otpauth://totp/Greenbro:test@example.com?secret=SECRET-123",
  });
  confirmTwoFactorMock.mockResolvedValue({ enabled: true });
  disableTwoFactorMock.mockResolvedValue({ enabled: false });
  listAuthSessionsMock.mockResolvedValue([]);
  toDataURLMock.mockResolvedValue("data:image/png;base64,qr");
  window.localStorage.clear();
  useAuthStore.setState((state) => ({
    ...state,
    hasHydrated: true,
    user: {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      role: "user",
      two_factor_enabled: false,
    },
  }));
});

describe("Profile page two-factor", () => {
  it("walks through the setup flow and shows success", async () => {
    await renderWithTheme();

    fireEvent.click(screen.getByTestId("enable-2fa-button"));

    await waitFor(() => expect(setupTwoFactorMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(toDataURLMock).toHaveBeenCalledWith(
        "otpauth://totp/Greenbro:test@example.com?secret=SECRET-123",
        expect.any(Object),
      ),
    );

    await waitFor(() => expect(screen.getByTestId("twofactor-secret").textContent).toContain("SECRET-123"));

    fireEvent.change(screen.getByTestId("twofactor-code-input"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm 2FA" }));

    await waitFor(() => expect(confirmTwoFactorMock).toHaveBeenCalledWith("123456"));
    expect(await screen.findByTestId("twofactor-success")).toBeInTheDocument();
  });

  it("shows enforcement badge and blocks disable when role is enforced", async () => {
    process.env.NEXT_PUBLIC_AUTH_2FA_ENFORCE_ROLES = "owner,admin";
    useAuthStore.setState((state) => ({
      ...state,
      user: { ...state.user!, role: "owner", two_factor_enabled: true },
    }));
    await renderWithTheme();

    expect(screen.getByTestId("2fa-enforced-badge")).toBeInTheDocument();
    const disableButton = screen.getByTestId("disable-2fa-button") as HTMLButtonElement;
    expect(disableButton).toBeDisabled();
  });

  it("keeps disable available when 2FA is optional", async () => {
    useAuthStore.setState((state) => ({
      ...state,
      user: { ...state.user!, role: "contractor", two_factor_enabled: true },
    }));
    await renderWithTheme();

    const disableButton = screen.getByTestId("disable-2fa-button") as HTMLButtonElement;
    expect(disableButton).not.toBeDisabled();
  });
});
