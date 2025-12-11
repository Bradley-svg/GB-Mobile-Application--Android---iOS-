import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/theme/ThemeProvider";
import type { WorkOrderDetail } from "@/lib/types/workOrders";
import { WorkOrderDetailView } from "@/app/app/work-orders/[workOrderId]/page";

const renderWithTheme = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

const baseWorkOrder: WorkOrderDetail = {
  id: "wo-1",
  organisation_id: "org-1",
  site_id: "site-1",
  device_id: null,
  alert_id: null,
  title: "Test work order",
  description: "Initial notes",
  status: "open",
  priority: "medium",
  assignee_user_id: null,
  created_by_user_id: "user-1",
  due_at: null,
  sla_due_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  tasks: [],
  attachments: [],
};

describe("Work order RBAC", () => {
  it("disables actions for contractor", () => {
    renderWithTheme(
      <WorkOrderDetailView
        workOrder={baseWorkOrder}
        canEdit={false}
        canChangeStatus={false}
        canBypassScan={false}
        isUpdating={false}
        onChangeStatus={vi.fn()}
        onSaveNotes={vi.fn()}
        onSaveSla={vi.fn()}
        readOnlyReason="Contractors are read-only"
      />,
    );

    expect(screen.getByRole("button", { name: "Save notes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mark open" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mark completed" })).toBeDisabled();
  });

  it("allows actions for admin/facilities/owner", () => {
    const onChangeStatus = vi.fn();
    renderWithTheme(
      <WorkOrderDetailView
        workOrder={{ ...baseWorkOrder, status: "in_progress" }}
        canEdit
        canChangeStatus
        canBypassScan
        isUpdating={false}
        onChangeStatus={onChangeStatus}
        onSaveNotes={vi.fn()}
        onSaveSla={vi.fn()}
      />,
    );

    const saveButton = screen.getByRole("button", { name: "Save notes" });
    const statusButton = screen.getByRole("button", { name: "Mark completed" });
    expect(saveButton).not.toBeDisabled();
    expect(statusButton).not.toBeDisabled();

    fireEvent.click(statusButton);
    expect(onChangeStatus).toHaveBeenCalledWith("done");
  });
});
