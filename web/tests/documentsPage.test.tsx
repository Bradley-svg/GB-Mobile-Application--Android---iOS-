import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DocumentsPage from "@/app/app/documents/page";
import { ThemeProvider } from "@/theme/ThemeProvider";
import type { Document } from "@/lib/types/documents";

const fetchFleetMock = vi.fn();
const listSiteDocumentsMock = vi.fn();
const listDeviceDocumentsMock = vi.fn();

vi.mock("@/lib/api/fleet", () => ({
  fetchFleet: (...args: unknown[]) => fetchFleetMock(...args),
}));

vi.mock("@/lib/api/documents", () => ({
  listSiteDocuments: (...args: unknown[]) => listSiteDocumentsMock(...args),
  listDeviceDocuments: (...args: unknown[]) => listDeviceDocumentsMock(...args),
  getDocumentDownloadUrl: vi.fn(),
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

describe("DocumentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFleetMock.mockResolvedValue({
      sites: [{ id: "site-1", name: "HQ" }],
      devices: [{ id: "device-1", name: "Heat pump", site_id: "site-1", site_name: "HQ" }],
    });

    const baseDoc: Document = {
      id: "doc-clean",
      title: "Clean manual",
      url: "/files/clean.pdf",
      category: "manual",
      fileStatus: "clean",
      createdAt: new Date().toISOString(),
      sizeBytes: 2048,
      siteId: "site-1",
    };

    const infectedDoc: Document = {
      ...baseDoc,
      id: "doc-infected",
      title: "Infected file",
      fileStatus: "infected",
    };

    const scanFailDoc: Document = {
      ...baseDoc,
      id: "doc-scanfail",
      title: "Scan failed file",
      fileStatus: "scan_failed",
      deviceId: "device-1",
    };

    listSiteDocumentsMock.mockResolvedValue([baseDoc, infectedDoc]);
    listDeviceDocumentsMock.mockResolvedValue([scanFailDoc]);
  });

  it("shows AV statuses and blocks downloads when not clean", async () => {
    renderWithProviders(<DocumentsPage />);

    await waitFor(() => expect(screen.getAllByTestId("document-row").length).toBeGreaterThan(0));

    expect(screen.getByText("Infected")).toBeInTheDocument();
    expect(screen.getByText("Scan failed")).toBeInTheDocument();

    const infectedButton = screen.getByTestId("download-btn-doc-infected");
    const scanFailedButton = screen.getByTestId("download-btn-doc-scanfail");

    expect(infectedButton).toBeDisabled();
    expect(scanFailedButton).toBeDisabled();
  });
});
