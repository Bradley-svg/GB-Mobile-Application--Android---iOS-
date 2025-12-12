"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card } from "@/components/ui";
import { requestSignedFileUrl } from "@/lib/api/files";
import { getWorkOrder, updateWorkOrderStatus } from "@/lib/api/workOrders";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { useDemoStatus } from "@/lib/useDemoStatus";
import { useOrgStore } from "@/lib/orgStore";
import { useUserRole } from "@/lib/useUserRole";
import type { WorkOrderAttachment, WorkOrderDetail, WorkOrderStatus } from "@/lib/types/workOrders";
import { useTheme } from "@/theme/ThemeProvider";
import { api } from "@/lib/api/httpClient";

type BadgeTone = "brand" | "neutral" | "success" | "warning" | "error" | "info";

type WorkOrderDetailViewProps = {
  workOrder: WorkOrderDetail;
  canEdit: boolean;
  canChangeStatus: boolean;
  canBypassScan: boolean;
  isUpdating: boolean;
  actionError?: string | null;
  onChangeStatus: (status: WorkOrderStatus) => Promise<void>;
  onSaveNotes: (notes: string) => Promise<void>;
  onSaveSla: (value: string | null) => Promise<void>;
  onDownloadAttachment?: (attachment: WorkOrderAttachment) => Promise<void>;
  readOnlyReason?: string | null;
};

const parseDate = (value?: string | null) => (value ? new Date(value) : null);
const toInputValue = (value?: string | null) => {
  const date = parseDate(value ?? null);
  if (!date) return "";
  const tzAdjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return tzAdjusted.toISOString().slice(0, 16);
};

const formatDateTime = (value?: string | null, fallback = "Unknown") => {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString();
};

const statusDisplay = (status: WorkOrderStatus) => {
  switch (status) {
    case "open":
      return { label: "Open", tone: "warning" as BadgeTone };
    case "in_progress":
      return { label: "In progress", tone: "warning" as BadgeTone };
    case "done":
      return { label: "Completed", tone: "success" as BadgeTone };
    case "cancelled":
    default:
      return { label: "Cancelled", tone: "neutral" as BadgeTone };
  }
};

const slaDisplay = (order: WorkOrderDetail) => {
  const now = new Date();
  const slaDueAt = parseDate(order.slaDueAt ?? order.sla_due_at ?? null);
  const resolvedAt = parseDate(order.resolvedAt ?? order.resolved_at ?? null);
  const slaBreached = order.slaBreached ?? order.sla_breached ?? false;
  const isClosed = order.status === "done" || order.status === "cancelled";
  const overdue = !isClosed && slaDueAt ? now.getTime() > slaDueAt.getTime() : false;
  const dueSoon =
    !isClosed && slaDueAt
      ? slaDueAt.getTime() - now.getTime() <= 24 * 60 * 60 * 1000 && slaDueAt.getTime() >= now.getTime()
      : false;

  if (!slaDueAt) return { label: "No SLA target", tone: "neutral" as BadgeTone, slaDueAt };
  if (isClosed) {
    return slaBreached || overdue
      ? { label: "Done (breached)", tone: "warning" as BadgeTone, slaDueAt, resolvedAt }
      : { label: "Done (SLA)", tone: "success" as BadgeTone, slaDueAt, resolvedAt };
  }
  if (overdue || slaBreached) return { label: "Breached", tone: "error" as BadgeTone, slaDueAt };
  if (dueSoon) return { label: "Due soon", tone: "warning" as BadgeTone, slaDueAt };
  return { label: "On track", tone: "success" as BadgeTone, slaDueAt };
};

const attachmentGuard = (attachment: WorkOrderAttachment, canBypassScan: boolean) => {
  const status = attachment.fileStatus ?? attachment.file_status ?? null;
  if (status === "infected") {
    return { blocked: true, tone: "error" as BadgeTone, label: "Infected", helper: "Download blocked after AV scan." };
  }
  if (status === "scan_failed") {
    return {
      blocked: !canBypassScan,
      tone: "warning" as BadgeTone,
      label: "Scan unavailable",
      helper: canBypassScan ? "Proceed with caution; scan failed." : "Only admins can open files with failed scans.",
    };
  }
  return { blocked: false, tone: "neutral" as BadgeTone, label: "Clean" };
};

const buildAttachmentUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const base = api.defaults.baseURL || "";
  return `${base.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
};

export function WorkOrderDetailView({
  workOrder,
  canEdit,
  canChangeStatus,
  canBypassScan,
  isUpdating,
  actionError,
  onChangeStatus,
  onSaveNotes,
  onSaveSla,
  onDownloadAttachment,
  readOnlyReason,
}: WorkOrderDetailViewProps) {
  const { theme } = useTheme();
  const [notes, setNotes] = useState(workOrder.description ?? "");
  const [slaInput, setSlaInput] = useState(toInputValue(workOrder.slaDueAt ?? workOrder.sla_due_at ?? null));

  useEffect(() => {
    setNotes(workOrder.description ?? "");
    setSlaInput(toInputValue(workOrder.slaDueAt ?? workOrder.sla_due_at ?? null));
  }, [workOrder.description, workOrder.id, workOrder.slaDueAt, workOrder.sla_due_at]);

  const sla = useMemo(() => slaDisplay(workOrder), [workOrder]);
  const status = useMemo(() => statusDisplay(workOrder.status), [workOrder.status]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
          <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" }}>
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone={sla.tone}>{sla.label}</Badge>
            {workOrder.priority ? <Badge tone="info">Priority {workOrder.priority.toUpperCase()}</Badge> : null}
          </div>
          <h2 style={{ margin: 0 }}>{workOrder.title}</h2>
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>
            {workOrder.site_name || "Unknown site"}
            {workOrder.device_name ? ` > ${workOrder.device_name}` : ""}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: theme.spacing.sm }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>Created</span>
              <strong>{formatDateTime(workOrder.created_at)}</strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>Updated</span>
              <strong>{formatRelativeTime(workOrder.updated_at, "Recently")}</strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>Due</span>
              <strong>{formatDateTime(workOrder.due_at, "Not set")}</strong>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.sm }}>
            <h3 style={{ margin: 0 }}>Status</h3>
            {!canChangeStatus ? (
              <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
                {readOnlyReason ?? "Updates disabled for your role."}
              </span>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
            {[
              { value: "open" as WorkOrderStatus, label: "Mark open" },
              { value: "in_progress" as WorkOrderStatus, label: "Start progress" },
              { value: "done" as WorkOrderStatus, label: "Mark completed" },
            ].map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={workOrder.status === option.value ? "primary" : "secondary"}
                disabled={!canChangeStatus || isUpdating}
                onClick={() => onChangeStatus(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {actionError ? <span style={{ color: theme.colors.error }}>{actionError}</span> : null}
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.sm }}>
            <h3 style={{ margin: 0 }}>SLA target</h3>
            <Badge tone={sla.tone}>{sla.label}</Badge>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, color: theme.colors.textSecondary }}>
            Due by
            <input
              type="datetime-local"
              value={slaInput}
              onChange={(evt) => setSlaInput(evt.target.value)}
              disabled={!canEdit || isUpdating}
              style={{
                padding: `${theme.spacing.sm}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                background: theme.colors.surfaceAlt,
                color: theme.colors.textPrimary,
              }}
            />
          </label>
          <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
            <Button
              size="sm"
              onClick={() => onSaveSla(slaInput || null)}
              disabled={!canEdit || isUpdating}
            >
              Save SLA
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSlaInput("");
                void onSaveSla(null);
              }}
              disabled={!canEdit || isUpdating}
            >
              Clear SLA
            </Button>
          </div>
          {!canEdit ? (
            <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
              {readOnlyReason ?? "SLA edits disabled for your role."}
            </span>
          ) : null}
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
          <h3 style={{ margin: 0 }}>Checklist</h3>
          {workOrder.tasks.length === 0 ? (
            <p style={{ color: theme.colors.textSecondary, margin: 0 }}>No tasks defined.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
              {workOrder.tasks.map((task) => (
                <label key={task.id} style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm }}>
                  <input type="checkbox" checked={task.is_completed} readOnly />
                  <span style={{ textDecoration: task.is_completed ? "line-through" : "none" }}>{task.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
          <h3 style={{ margin: 0 }}>Notes</h3>
          <textarea
            value={notes}
            onChange={(evt) => setNotes(evt.target.value)}
            disabled={!canEdit || isUpdating}
            rows={5}
            style={{
              width: "100%",
              padding: theme.spacing.sm,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.borderSubtle}`,
              background: theme.colors.surfaceAlt,
              color: theme.colors.textPrimary,
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: theme.spacing.sm, alignItems: "center" }}>
            <Button size="sm" onClick={() => onSaveNotes(notes)} disabled={!canEdit || isUpdating}>
              Save notes
            </Button>
            {!canEdit ? (
              <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
                {readOnlyReason ?? "Notes are read-only for your role."}
              </span>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.sm }}>
            <h3 style={{ margin: 0 }}>Attachments</h3>
            <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
              Downloads use signed URLs for safety.
            </span>
          </div>
          {workOrder.attachments.length === 0 ? (
            <p style={{ color: theme.colors.textSecondary, margin: 0 }}>No attachments yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
              {workOrder.attachments.map((attachment) => {
                const guard = attachmentGuard(attachment, canBypassScan);
                return (
                  <div
                    key={attachment.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 140px 140px",
                      gap: theme.spacing.sm,
                      alignItems: "center",
                      padding: `${theme.spacing.xs}px 0`,
                      borderBottom: `1px solid ${theme.colors.borderSubtle}`,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <strong>{attachment.originalName ?? "Attachment"}</strong>
                      <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
                        {attachment.mimeType ?? attachment.mime_type ?? "Unknown type"}
                      </span>
                    </div>
                    <Badge tone={guard.tone}>{guard.label}</Badge>
                    <div style={{ display: "flex", gap: theme.spacing.xs, justifyContent: "flex-end" }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={guard.blocked || isUpdating}
                        onClick={() => onDownloadAttachment?.(attachment)}
                      >
                        Download
                      </Button>
                    </div>
                    {guard.helper ? (
                      <span style={{ gridColumn: "1 / span 3", color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
                        {guard.helper}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function WorkOrderDetailPage() {
  const params = useParams<{ workOrderId: string }>();
  const workOrderId = params?.workOrderId;
  const currentOrgId = useOrgStore((s) => s.currentOrgId);
  const { isContractor, isAdmin, isOwner, isFacilities } = useUserRole();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const demoStatus = useDemoStatus();
  const isDemoOrg = demoStatus.data?.isDemoOrg ?? false;

  const workOrderQuery = useQuery({
    queryKey: ["work-order", workOrderId, currentOrgId],
    enabled: !!workOrderId,
    queryFn: () => getWorkOrder(workOrderId as string, currentOrgId),
  });

  const updateMutation = useMutation({
    mutationFn: (body: { status?: WorkOrderStatus; description?: string | null; slaDueAt?: string | null }) =>
      updateWorkOrderStatus({
        workOrderId: workOrderId as string,
        orgId: currentOrgId ?? undefined,
        status: body.status,
        description: body.description,
        slaDueAt: body.slaDueAt,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["work-order", workOrderId, currentOrgId], data);
    },
  });

  const confirmDemoChange = (label: string) => {
    if (!isDemoOrg) return true;
    return window.confirm(`Demo mode: ${label}`);
  };

  const canEdit = !isContractor;
  const canChangeStatus = canEdit && (isAdmin || isOwner || isFacilities);
  const canBypassScan = isAdmin || isOwner || isFacilities;

  const handleStatusChange = async (status: WorkOrderStatus) => {
    if (!canChangeStatus) {
      setActionError("Status changes are limited to admin, facilities, or owner roles.");
      return;
    }
    if (!confirmDemoChange("Update work order status?")) {
      return;
    }
    setActionError(null);
    try {
      await updateMutation.mutateAsync({ status });
    } catch (err) {
      console.error(err);
      setActionError("Could not update status. Please retry.");
    }
  };

  const handleSaveNotes = async (notes: string) => {
    if (!canEdit) {
      setActionError("Notes are read-only for contractors.");
      return;
    }
    if (!confirmDemoChange("Save work order notes?")) {
      return;
    }
    setActionError(null);
    try {
      await updateMutation.mutateAsync({ description: notes });
    } catch (err) {
      console.error(err);
      setActionError("Could not save notes. Please retry.");
    }
  };

  const handleSaveSla = async (value: string | null) => {
    if (!canEdit) {
      setActionError("SLA fields are read-only for contractors.");
      return;
    }
    if (!confirmDemoChange("Update the SLA target?")) {
      return;
    }
    setActionError(null);
    try {
      const iso = value ? new Date(value).toISOString() : null;
      await updateMutation.mutateAsync({ slaDueAt: iso });
    } catch (err) {
      console.error(err);
      setActionError("Could not update SLA. Please retry.");
    }
  };

  const downloadAttachment = async (attachment: WorkOrderAttachment) => {
    const guard = attachmentGuard(attachment, canBypassScan);
    if (guard.blocked) {
      setActionError(guard.helper ?? "Download blocked for this file.");
      return;
    }
    setActionError(null);
    try {
      const signedUrl = await requestSignedFileUrl(attachment.id);
      const target = buildAttachmentUrl(signedUrl || attachment.url);
      if (target) {
        window.open(target, "_blank", "noopener,noreferrer");
      } else {
        setActionError("Attachment URL is unavailable.");
      }
    } catch (err) {
      console.error(err);
      setActionError("Could not fetch download URL.");
    }
  };

  if (!workOrderId) {
    return <div>Missing work order id.</div>;
  }

  if (workOrderQuery.isLoading) {
    return <div>Loading work order...</div>;
  }

  if (workOrderQuery.isError || !workOrderQuery.data) {
    return <div>Could not load work order.</div>;
  }

  return (
    <WorkOrderDetailView
      workOrder={workOrderQuery.data}
      canEdit={canEdit}
      canChangeStatus={canChangeStatus}
      canBypassScan={canBypassScan}
      isUpdating={updateMutation.isPending}
      actionError={actionError}
      onChangeStatus={handleStatusChange}
      onSaveNotes={handleSaveNotes}
      onSaveSla={handleSaveSla}
      onDownloadAttachment={downloadAttachment}
      readOnlyReason={isContractor ? "Contractors have read-only access here." : undefined}
    />
  );
}
