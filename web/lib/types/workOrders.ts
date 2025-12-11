export type WorkOrderStatus = "open" | "in_progress" | "done" | "cancelled";
export type WorkOrderPriority = "low" | "medium" | "high";
export type FileStatus = "clean" | "infected" | "scan_failed";

export type WorkOrder = {
  id: string;
  organisation_id: string;
  site_id: string;
  device_id: string | null;
  alert_id: string | null;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  assignee_user_id: string | null;
  created_by_user_id: string;
  due_at: string | null;
  slaDueAt?: string | null;
  sla_due_at?: string | null;
  resolvedAt?: string | null;
  resolved_at?: string | null;
  slaBreached?: boolean;
  sla_breached?: boolean;
  reminderAt?: string | null;
  reminder_at?: string | null;
  category?: "maintenance" | "breakdown" | "inspection" | string | null;
  created_at: string;
  updated_at: string;
  site_name?: string | null;
  device_name?: string | null;
  alert_severity?: "info" | "warning" | "critical" | null;
};

export type WorkOrderTask = {
  id: string;
  label: string;
  is_completed: boolean;
  position: number;
};

export type WorkOrderAttachment = {
  id: string;
  originalName?: string;
  original_name?: string;
  label?: string | null;
  url: string;
  mimeType?: string | null;
  mime_type?: string | null;
  sizeBytes?: number | null;
  size_bytes?: number | null;
  created_at?: string;
  createdAt?: string;
  relative_path?: string | null;
  fileStatus?: FileStatus | null;
  file_status?: FileStatus | null;
};

export type WorkOrderDetail = WorkOrder & {
  tasks: WorkOrderTask[];
  attachments: WorkOrderAttachment[];
};

export type WorkOrderFilters = {
  status?: WorkOrderStatus | "all";
  siteId?: string;
  deviceId?: string;
  alertId?: string;
  q?: string;
};
