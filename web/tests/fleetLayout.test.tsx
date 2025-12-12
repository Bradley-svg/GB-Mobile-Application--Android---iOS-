import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FleetOverviewPage from "@/app/app/page";
import { ThemeProvider } from "@/theme/ThemeProvider";
import type { DeviceTelemetry } from "@/lib/types/telemetry";
import { useOrgStore } from "@/lib/orgStore";

const fetchFleetMock = vi.fn();
const fetchTelemetryMock = vi.fn();
let demoStatus = { isDemoOrg: false, heroDeviceId: null as string | null, heroDeviceMac: null as string | null, seededAt: null as string | null };

vi.mock("@/lib/api/fleet", () => ({
  fetchFleet: (...args: unknown[]) => fetchFleetMock(...args),
}));

vi.mock("@/lib/api/devices", () => ({
  fetchDeviceTelemetry: (...args: unknown[]) => fetchTelemetryMock(...args),
}));

vi.mock("@/lib/useDemoStatus", () => ({
  useDemoStatus: () => ({ data: demoStatus, isLoading: false }),
}));

const renderWithProviders = (ui: ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
};

describe("FleetOverviewPage layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOrgStore.setState({ currentOrgId: "org-1", orgs: [], loading: false });
    demoStatus = { isDemoOrg: false, heroDeviceId: null, heroDeviceMac: null, seededAt: null };

    fetchFleetMock.mockResolvedValue({
      sites: [{ id: "site-1", name: "HQ" }],
      devices: [
        {
          id: "dev-1",
          site_id: "site-1",
          name: "Heat Pump #1",
          mac: "AA:BB:CC:DD",
          site_name: "HQ",
          health: "healthy",
          last_seen: { at: "2024-01-01T00:00:00Z", ageMinutes: 5, isStale: false, isOffline: false },
        },
        {
          id: "dev-2",
          site_id: "site-1",
          name: "Offline Pump",
          mac: "EE:FF:GG:HH",
          site_name: "HQ",
          health: "offline",
          last_seen: { at: "2024-01-01T00:10:00Z", ageMinutes: 120, isStale: true, isOffline: true },
        },
      ],
    });

    const telemetry: DeviceTelemetry = {
      range: "1h",
      metrics: {
        tank_temp: [{ ts: "2024-01-01T00:00:00Z", value: 48 }],
        dhw_temp: [{ ts: "2024-01-01T00:00:00Z", value: 46 }],
        ambient_temp: [{ ts: "2024-01-01T00:00:00Z", value: 18 }],
        compressor_current: [{ ts: "2024-01-01T00:00:00Z", value: 6 }],
        eev_steps: [{ ts: "2024-01-01T00:00:00Z", value: 280 }],
        mode: [{ ts: "2024-01-01T00:00:00Z", value: 1 }],
        defrost: [{ ts: "2024-01-01T00:00:00Z", value: 0 }],
      },
    };
    fetchTelemetryMock.mockResolvedValue(telemetry);
  });

  it("renders fleet summary layout", async () => {
    const { asFragment } = renderWithProviders(<FleetOverviewPage />);

    await waitFor(() => expect(fetchFleetMock).toHaveBeenCalled());
    await screen.findByText("Fleet overview");

    expect(asFragment()).toMatchSnapshot();
  });

  it("renders large fleet fixtures without refetch churn", async () => {
    const largeFleet = Array.from({ length: 24 }).map((_, idx) => ({
      id: `dev-${idx}`,
      site_id: "site-1",
      name: `Heat Pump #${idx}`,
      mac: `AA:BB:CC:${idx.toString().padStart(2, "0")}`,
      site_name: "HQ",
      health: idx % 3 === 0 ? "offline" : "healthy",
      last_seen: { at: "2024-01-01T00:00:00Z", ageMinutes: idx, isStale: false, isOffline: idx % 3 === 0 },
    }));

    fetchFleetMock.mockResolvedValueOnce({
      sites: [{ id: "site-1", name: "HQ" }],
      devices: largeFleet,
    });

    renderWithProviders(<FleetOverviewPage />);

    await waitFor(() => expect(fetchFleetMock).toHaveBeenCalled());
    await screen.findByText("Heat Pump #0");
    expect(fetchTelemetryMock).toHaveBeenCalledTimes(largeFleet.length);
  });

  it("shows waiting copy when telemetry is empty in demo mode", async () => {
    demoStatus = { isDemoOrg: true, heroDeviceId: null, heroDeviceMac: null, seededAt: null };
    fetchTelemetryMock.mockResolvedValue({ range: "1h", metrics: {} });

    renderWithProviders(<FleetOverviewPage />);

    await waitFor(() => expect(fetchTelemetryMock).toHaveBeenCalled());
    await screen.findByText(/Waiting for live data/i);
  });
});
