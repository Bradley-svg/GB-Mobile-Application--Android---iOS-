import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import LoginPage from "./page";
import { ThemeProvider } from "@/theme/ThemeProvider";

const replace = vi.fn();
const mockLogin = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("@/lib/authStore", () => ({
  useAuthStore: (selector: (state: { login: typeof mockLogin }) => unknown) =>
    selector({
      login: mockLogin,
    }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    replace.mockReset();
    mockLogin.mockReset();
  });

  it("submits login and redirects on success", async () => {
    mockLogin.mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      user: { id: "1", email: "demo@greenbro.com" },
    });

    render(
      <ThemeProvider>
        <LoginPage />
      </ThemeProvider>,
    );

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "demo@greenbro.com");
    await userEvent.type(screen.getByPlaceholderText("********"), "password123");
    await userEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalled());
    expect(mockLogin).toHaveBeenCalledWith("demo@greenbro.com", "password123");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app"));
  });
});
