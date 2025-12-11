import type { WorkOrderStatus } from "./workOrders";

export type MaintenanceSummaryItem = {
  workOrderId: string;
  title: string;
  siteName: string | null;
  deviceName: string | null;
  slaDueAt: string;
  status: WorkOrderStatus;
};

export type MaintenanceSummary = {
  openCount: number;
  overdueCount: number;
  dueSoonCount: number;
  byDate: Array<{
    date: string;
    open: MaintenanceSummaryItem[];
    overdue: MaintenanceSummaryItem[];
    done: MaintenanceSummaryItem[];
  }>;
};
