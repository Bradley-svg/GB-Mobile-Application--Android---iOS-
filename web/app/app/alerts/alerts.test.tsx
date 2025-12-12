import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import AlertsPage from "./page";
import AlertDetailPage from "./[alertId]/page";
import type { Alert } from "@/lib/types/alerts";
import { ThemeProvider } from "@/theme/ThemeProvider";

const listAlertsMock = vi.fn();
const getAlertMock = vi.fn();
const listRulesForDeviceMock = vi.fn();
const listRulesForSiteMock = vi.fn();
let demoStatus = { isDemoOrg: false, heroDeviceId: null as string | null, heroDeviceMac: null as string | null, seededAt: null as string | null };

vi.mock("@/lib/api/alerts", () => ({
  listAlerts: (...args: unknown[]) => listAlertsMock(...args),
  getAlert: (...args: unknown[]) => getAlertMock(...args),
  listAlertRulesForDevice: (...args: unknown[]) => listRulesForDeviceMock(...args),
  listAlertRulesForSite: (...args: unknown[]) => listRulesForSiteMock(...args),
  ackAlert: vi.fn(),
  snoozeAlert: vi.fn(),
  muteAlert: vi.fn(),
}));

let mockRole = {
  role: "admin",
  isOwner: false,
  isAdmin: true,
  isFacilities: false,
  isContractor: false,
};

vi.mock("@/lib/useUserRole", () => ({
  useUserRole: () => mockRole,
}));

vi.mock("@/lib/useDemoStatus", () => ({
  useDemoStatus: () => ({ data: demoStatus, isLoading: false }),
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ alertId: "alert-1" }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
}

const baseAlert: Alert = {
  id: "alert-1",
  site_id: "site-1",
  device_id: "device-1",
  severity: "critical",
  type: "offline",
  message: "Device offline",
  status: "active",
  first_seen_at: new Date().toISOString(),
  last_seen_at: new Date().toISOString(),
  acknowledged_by: null,
  acknowledged_at: null,
  muted_until: null,
  rule_id: "rule-1",
  rule_name: "Offline rule",
  site_name: "HQ",
  device_name: "Heat pump",
};

describe("Alerts pages", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockRole = {
      role: "admin",
      isOwner: false,
      isAdmin: true,
      isFacilities: false,
      isContractor: false,
    };
    demoStatus = { isDemoOrg: false, heroDeviceId: null, heroDeviceMac: null, seededAt: null };
    listAlertsMock.mockReset();
    getAlertMock.mockReset();
    listRulesForDeviceMock.mockReset();
    listRulesForSiteMock.mockReset();
    listAlertsMock.mockResolvedValue([]);
    getAlertMock.mockResolvedValue(baseAlert);
    listRulesForDeviceMock.mockResolvedValue([]);
    listRulesForSiteMock.mockResolvedValue([]);
  });

  it("shows loading then empty state on alerts list", async () => {
    renderWithProviders(<AlertsPage />);

    expect(await screen.findByTestId("alerts-skeleton")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText(/No open alerts/i)).toBeInTheDocument());
    expect(listAlertsMock).toHaveBeenCalled();
  });

  it("respects action visibility for admin versus contractor", async () => {
    renderWithProviders(<AlertDetailPage />);

    const adminAck = await screen.findByRole("button", { name: /acknowledge/i });
    expect(adminAck).not.toBeDisabled();
    expect(screen.queryByText(/Contractor roles cannot/i)).not.toBeInTheDocument();

    cleanup();

    mockRole = {
      role: "contractor",
      isOwner: false,
      isAdmin: false,
      isFacilities: false,
      isContractor: true,
    };

    getAlertMock.mockResolvedValue(baseAlert);
    renderWithProviders(<AlertDetailPage />);

    const contractorAck = await screen.findByRole("button", { name: /acknowledge/i });
    expect(contractorAck).toBeDisabled();
    expect(screen.getByText(/Contractor roles cannot acknowledge or mute alerts/i)).toBeInTheDocument();
  });
});
