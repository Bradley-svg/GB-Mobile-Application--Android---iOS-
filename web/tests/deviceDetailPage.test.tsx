import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DeviceDetailPage from "@/app/app/devices/[deviceId]/page";
import { ThemeProvider } from "@/theme/ThemeProvider";
import type { ApiDevice } from "@/lib/types/fleet";
import type { DeviceTelemetry } from "@/lib/types/telemetry";
import type { HeatPumpHistoryResponse } from "@/lib/types/history";
import { useOrgStore } from "@/lib/orgStore";

const fetchDeviceMock = vi.fn();
const fetchTelemetryMock = vi.fn();
const fetchHistoryMock = vi.fn();
const fetchHealthMock = vi.fn();

vi.mock("@/lib/api/devices", () => ({
  fetchDevice: (...args: unknown[]) => fetchDeviceMock(...args),
  fetchDeviceTelemetry: (...args: unknown[]) => fetchTelemetryMock(...args),
}));

vi.mock("@/lib/api/heatPumpHistory", () => ({
  fetchHeatPumpHistory: (...args: unknown[]) => fetchHistoryMock(...args),
}));

vi.mock("@/lib/api/healthPlus", () => ({
  fetchHealthPlus: (...args: unknown[]) => fetchHealthMock(...args),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ deviceId: "device-1" }),
  useSearchParams: () => new URLSearchParams(),
}));

const renderWithProviders = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <DeviceDetailPage />
      </QueryClientProvider>
    </ThemeProvider>,
  );
};

const buildTelemetryPoints = (count: number, base: number) =>
  Array.from({ length: count }).map((_, idx) => ({
    ts: new Date(Date.UTC(2024, 0, 1, 0, idx)).toISOString(),
    value: base + (idx % 5),
  }));

const buildHistoryPoints = (count: number, base: number) =>
  Array.from({ length: count }).map((_, idx) => ({
    timestamp: new Date(Date.UTC(2024, 0, 1, 0, idx)).toISOString(),
    value: base + (idx % 3),
  }));

describe("DeviceDetailPage large fixtures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOrgStore.setState({ currentOrgId: "org-1", orgs: [], loading: false });

    const device: ApiDevice = {
      id: "device-1",
      site_id: "site-1",
      name: "Heat Pump Large",
      mac: "AA:BB:CC:DD:EE:FF",
      site_name: "HQ",
      health: "healthy",
      last_seen: { at: new Date().toISOString(), ageMinutes: 5, isStale: false, isOffline: false },
      status: "online",
      firmware_version: "1.2.3",
    };

    const telemetry: DeviceTelemetry = {
      range: "6h",
      metrics: {
        tank_temp: buildTelemetryPoints(240, 45),
        dhw_temp: buildTelemetryPoints(240, 40),
        ambient_temp: buildTelemetryPoints(240, 18),
        supply_temp: buildTelemetryPoints(240, 50),
        return_temp: buildTelemetryPoints(240, 42),
        compressor_current: buildTelemetryPoints(120, 8),
        eev_steps: buildTelemetryPoints(120, 250),
        mode: buildTelemetryPoints(4, 1),
      },
    };

    const history: HeatPumpHistoryResponse = {
      series: [
        {
          field: "metric_compCurrentA",
          points: buildHistoryPoints(320, 8),
        },
      ],
    };

    fetchDeviceMock.mockResolvedValue(device);
    fetchTelemetryMock.mockResolvedValue(telemetry);
    fetchHistoryMock.mockResolvedValue(history);
    fetchHealthMock.mockResolvedValue({
      ok: true,
      env: "test",
      db: "ok",
      dbLatencyMs: 1,
      version: "test",
      vendorFlags: { prodLike: false, disabled: [], mqttDisabled: false, controlDisabled: false, heatPumpHistoryDisabled: false, pushNotificationsDisabled: false },
      mqtt: { configured: false, connected: false, lastMessageAt: null, lastIngestAt: null, lastErrorAt: null, lastError: null, healthy: true },
      control: { configured: false, disabled: false, lastCommandAt: null, lastErrorAt: null, lastError: null, healthy: true },
      heatPumpHistory: {
        configured: true,
        disabled: false,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastError: null,
        lastCheckAt: null,
        healthy: true,
      },
      alertsWorker: { lastHeartbeatAt: null, healthy: true },
      push: { enabled: false, disabled: false, lastSampleAt: null, lastError: null },
      antivirus: {
        configured: false,
        enabled: false,
        target: null,
        lastRunAt: null,
        lastResult: null,
        lastError: null,
        latencyMs: null,
      },
      maintenance: { openCount: 0, overdueCount: 0, lastCalcAt: null },
      storage: { root: "/tmp", writable: true, latencyMs: 1 },
      alertsEngine: {
        lastRunAt: null,
        lastDurationMs: null,
        rulesLoaded: null,
        activeAlertsTotal: null,
        activeWarning: null,
        activeCritical: null,
        activeInfo: null,
        evaluated: null,
        triggered: null,
      },
    } as any);
  });

  it("renders large telemetry and history datasets without duplicate fetches", async () => {
    renderWithProviders();

    await screen.findByText("Heat Pump Large");
    await waitFor(() => expect(fetchTelemetryMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /metrics/i }));
    await screen.findByText("Telemetry");
    expect(fetchTelemetryMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /history/i }));
    await waitFor(() => expect(fetchHistoryMock).toHaveBeenCalledTimes(1));
  });
});
