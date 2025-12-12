import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DemoModeBadge } from "@/components/DemoModeBadge";
import { ThemeProvider } from "@/theme/ThemeProvider";

let demoStatus = { isDemoOrg: true, heroDeviceId: "dev-1", heroDeviceMac: "AA:BB", seededAt: "2025-01-01T00:00:00Z" };

vi.mock("@/lib/useDemoStatus", () => ({
  useDemoStatus: () => ({ data: demoStatus, isLoading: false }),
}));

describe("DemoModeBadge", () => {
  it("renders pill when demo org", () => {
    render(
      <ThemeProvider>
        <DemoModeBadge />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("demo-mode-pill")).toHaveTextContent(/Demo mode/i);
  });

  it("hides pill when not in demo org", () => {
    demoStatus = { isDemoOrg: false, heroDeviceId: null, heroDeviceMac: null, seededAt: null };
    render(
      <ThemeProvider>
        <DemoModeBadge />
      </ThemeProvider>,
    );

    expect(screen.queryByTestId("demo-mode-pill")).not.toBeInTheDocument();
  });
});
