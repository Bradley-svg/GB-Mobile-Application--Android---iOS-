import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import MaintenancePage from "@/app/app/maintenance/page";
import { ThemeProvider } from "@/theme/ThemeProvider";

vi.mock("@/lib/api/maintenance", () => ({
  listMaintenanceSummary: vi.fn().mockResolvedValue({ openCount: 0, overdueCount: 0, dueSoonCount: 0, byDate: [] }),
}));

vi.mock("@/lib/api/fleet", () => ({
  fetchFleet: vi.fn().mockResolvedValue({ devices: [], sites: [] }),
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const client = new QueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
};

describe("Maintenance empty state", () => {
  it("shows empty state when summary is empty", async () => {
    renderWithProviders(<MaintenancePage />);
    const empty = await screen.findByTestId("maintenance-empty");
    expect(empty).toHaveTextContent(/All clear/i);
  });
});
