import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SharingPage from "@/app/app/sharing/page";
import { ThemeProvider } from "@/theme/ThemeProvider";
import type { ShareLink } from "@/lib/types/shareLinks";

const fetchFleetMock = vi.fn();
const listShareLinksMock = vi.fn();
const createShareLinkMock = vi.fn();
const revokeShareLinkMock = vi.fn();

let mockRole = {
  role: "admin",
  isOwner: false,
  isAdmin: true,
  isFacilities: false,
  isContractor: false,
};

vi.mock("@/lib/api/fleet", () => ({
  fetchFleet: (...args: unknown[]) => fetchFleetMock(...args),
}));

vi.mock("@/lib/api/shareLinks", () => ({
  listShareLinks: (...args: unknown[]) => listShareLinksMock(...args),
  createShareLink: (...args: unknown[]) => createShareLinkMock(...args),
  revokeShareLink: (...args: unknown[]) => revokeShareLinkMock(...args),
}));

vi.mock("@/lib/useUserRole", () => ({
  useUserRole: () => mockRole,
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
};

describe("SharingPage RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = {
      role: "admin",
      isOwner: false,
      isAdmin: true,
      isFacilities: false,
      isContractor: false,
    };
    fetchFleetMock.mockResolvedValue({
      sites: [{ id: "site-1", name: "HQ" }],
      devices: [{ id: "device-1", name: "Heat pump", site_id: "site-1" }],
    });
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const link: ShareLink = {
      id: "link-1",
      scopeType: "site",
      scopeId: "site-1",
      token: "abc123",
      permissions: "read_only",
      expiresAt: future,
      createdAt: future,
      createdBy: { name: "Alice" },
    };
    listShareLinksMock.mockResolvedValue([link]);
    createShareLinkMock.mockResolvedValue(link);
    revokeShareLinkMock.mockResolvedValue(undefined);
  });

  it("allows admins to create and revoke share links", async () => {
    renderWithProviders(<SharingPage />);

    await waitFor(() => expect(screen.getByTestId("share-link-row")).toBeInTheDocument());

    const createButton = screen.getByRole("button", { name: /create share link/i });
    const revokeButton = screen.getByRole("button", { name: /revoke/i });

    expect(createButton).not.toBeDisabled();
    expect(revokeButton).not.toBeDisabled();
  });

  it("shows read-only state for contractors", async () => {
    mockRole = {
      role: "contractor",
      isOwner: false,
      isAdmin: false,
      isFacilities: false,
      isContractor: true,
    };

    renderWithProviders(<SharingPage />);

    await waitFor(() => expect(screen.getByTestId("share-link-row")).toBeInTheDocument());

    const createButton = screen.getByRole("button", { name: /create share link/i });
    const revokeButton = screen.getByRole("button", { name: /revoke/i });

    expect(createButton).toBeDisabled();
    expect(revokeButton).toBeDisabled();
    expect(screen.getByText(/Contractors can view only/i)).toBeInTheDocument();
  });
});
