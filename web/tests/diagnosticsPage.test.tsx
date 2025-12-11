import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DiagnosticsPage from "@/app/app/diagnostics/page";
import { useAuthStore } from "@/lib/authStore";
import type { HealthPlusPayload } from "@/lib/types/healthPlus";
import { ThemeProvider } from "@/theme/ThemeProvider";

const fetchHealthPlusMock = vi.fn();

vi.mock("@/lib/api/healthPlus", () => ({
  fetchHealthPlus: (...args: unknown[]) => fetchHealthPlusMock(...args),
}));

const baseHealth: HealthPlusPayload = {
  ok: true,
  env: "test",
  db: "ok",
  dbLatencyMs: 12,
  version: "1.0.0",
  vendorFlags: {
    prodLike: false,
    disabled: [],
    mqttDisabled: false,
    controlDisabled: false,
    heatPumpHistoryDisabled: false,
    pushNotificationsDisabled: false,
  },
  mqtt: {
    configured: true,
    disabled: false,
    connected: true,
    lastMessageAt: new Date().toISOString(),
    lastIngestAt: new Date().toISOString(),
    lastErrorAt: null,
    lastError: null,
    healthy: true,
  },
  control: {
    configured: true,
    disabled: false,
    lastCommandAt: new Date().toISOString(),
    lastErrorAt: null,
    lastError: null,
    healthy: true,
  },
  heatPumpHistory: {
    configured: true,
    disabled: false,
    lastSuccessAt: new Date().toISOString(),
    lastErrorAt: null,
    lastError: null,
    lastCheckAt: new Date().toISOString(),
    healthy: true,
  },
  alertsWorker: {
    healthy: true,
    lastHeartbeatAt: new Date().toISOString(),
  },
  push: {
    enabled: true,
    disabled: false,
    lastSampleAt: new Date().toISOString(),
    lastError: null,
  },
  antivirus: {
    configured: true,
    enabled: true,
    target: "command",
    lastRunAt: new Date().toISOString(),
    lastResult: "clean",
    lastError: null,
    latencyMs: 5,
  },
  maintenance: {
    openCount: 0,
    overdueCount: 0,
    lastCalcAt: new Date().toISOString(),
  },
  storage: {
    root: "/tmp",
    writable: true,
    latencyMs: 3,
  },
  alertsEngine: {
    lastRunAt: new Date().toISOString(),
    lastDurationMs: 20,
    rulesLoaded: 5,
    activeAlertsTotal: 1,
    activeWarning: 0,
    activeCritical: 1,
    activeInfo: 0,
    evaluated: 10,
    triggered: 1,
  },
};

const renderDiagnostics = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <DiagnosticsPage />
      </QueryClientProvider>
    </ThemeProvider>,
  );
  await waitFor(() => expect(fetchHealthPlusMock).toHaveBeenCalled());
  return view;
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  fetchHealthPlusMock.mockResolvedValue({ ...baseHealth });
  useAuthStore.setState((state) => ({
    ...state,
    user: { id: "user-1", email: "admin@test.com", role: "owner" },
  }));
});

describe("DiagnosticsPage", () => {
  it("shows disabled, failing, and healthy subsystem pills", async () => {
    fetchHealthPlusMock.mockResolvedValue({
      ...baseHealth,
      vendorFlags: {
        ...baseHealth.vendorFlags!,
        disabled: ["MQTT_DISABLED"],
        mqttDisabled: true,
      },
      mqtt: { ...baseHealth.mqtt, disabled: true, healthy: false },
      control: { ...baseHealth.control, healthy: false, lastError: "failure" },
    });

    await renderDiagnostics();

    expect(await screen.findByTestId("diag-mqtt-status")).toHaveTextContent(/Disabled/i);
    expect(screen.getByTestId("diag-control-status")).toHaveTextContent(/Failing/i);
    expect(screen.getByTestId("diag-storage-status")).toHaveTextContent(/Healthy/i);
  });

  it("copies the raw payload JSON", async () => {
    const writeText = vi.fn();
    // @ts-expect-error jsdom navigator shaping
    navigator.clipboard = { writeText };

    await renderDiagnostics();

    const copyButton = await screen.findByTestId("diagnostics-copy-json");
    fireEvent.click(copyButton);

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const payload = JSON.parse(writeText.mock.calls[0][0]);
    expect(payload.env).toBe("test");
    expect(payload.db).toBe("ok");
  });
});
