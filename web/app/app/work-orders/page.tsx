"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card } from "@/components/ui";
import { listWorkOrders } from "@/lib/api/workOrders";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { useOrgStore } from "@/lib/orgStore";
import type { WorkOrder, WorkOrderStatus } from "@/lib/types/workOrders";
import { useTheme } from "@/theme/ThemeProvider";

type StatusFilter = "all" | WorkOrderStatus;
type SlaFilter = "all" | "on_track" | "breached";

const parseDate = (value?: string | null) => (value ? new Date(value) : null);

const formatDate = (value?: string | null, fallback = "Unknown") => {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString();
};

const statusDisplay = (status: WorkOrderStatus) => {
  switch (status) {
    case "open":
      return { label: "Open", tone: "warning" as const };
    case "in_progress":
      return { label: "In progress", tone: "warning" as const };
    case "done":
      return { label: "Completed", tone: "success" as const };
    case "cancelled":
    default:
      return { label: "Cancelled", tone: "neutral" as const };
  }
};

const slaDisplay = (order: WorkOrder) => {
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

  if (!slaDueAt) return { label: "No SLA", tone: "neutral" as const, slaDueAt };
  if (isClosed) {
    return slaBreached || overdue
      ? { label: "Done (breached)", tone: "warning" as const, slaDueAt, resolvedAt }
      : { label: "Done (SLA)", tone: "success" as const, slaDueAt, resolvedAt };
  }
  if (overdue || slaBreached) return { label: "Breached", tone: "error" as const, slaDueAt };
  if (dueSoon) return { label: "Due soon", tone: "warning" as const, slaDueAt };
  return { label: "On track", tone: "success" as const, slaDueAt };
};

const ListSkeleton = ({ rows = 5 }: { rows?: number }) => {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: "160px 140px 1fr 200px 160px 140px",
            gap: theme.spacing.sm,
            alignItems: "center",
            padding: `${theme.spacing.sm}px`,
            background: theme.colors.surface,
            borderRadius: theme.radius.md,
            border: `1px solid ${theme.colors.borderSubtle}`,
            animation: "pulse 1.2s ease-in-out infinite",
          }}
        >
          {Array.from({ length: 6 }).map((__, col) => (
            <div
              key={col}
              style={{
                height: 14,
                borderRadius: theme.radius.sm,
                background: theme.colors.backgroundAlt,
              }}
            />
          ))}
        </div>
      ))}
      <style>{`@keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }`}</style>
    </div>
  );
};

export default function WorkOrdersPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const currentOrgId = useOrgStore((s) => s.currentOrgId);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [slaFilter, setSlaFilter] = useState<SlaFilter>("all");

  const workOrdersQuery = useQuery({
    queryKey: ["work-orders", statusFilter, currentOrgId],
    queryFn: () =>
      listWorkOrders({
        orgId: currentOrgId ?? undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  const orders = useMemo(() => workOrdersQuery.data ?? [], [workOrdersQuery.data]);
  const filteredOrders = useMemo(() => {
    const bySla = orders.filter((order) => {
      if (slaFilter === "all") return true;
      const sla = slaDisplay(order);
      if (slaFilter === "on_track") return sla.tone === "success" || sla.tone === "neutral";
      return sla.tone === "error" || sla.label.toLowerCase().includes("breach");
    });
    return bySla;
  }, [orders, slaFilter]);

  const renderRow = (order: WorkOrder) => {
    const status = statusDisplay(order.status);
    const sla = slaDisplay(order);
    const locationLabel = `${order.site_name || "Unknown site"}${order.device_name ? ` > ${order.device_name}` : ""}`;
    const updatedLabel = formatRelativeTime(order.updated_at, "Recently");

    return (
      <button
        key={order.id}
        type="button"
        onClick={() => router.push(`/app/work-orders/${order.id}`)}
        style={{
          display: "grid",
          gridTemplateColumns: "160px 140px 1fr 200px 160px 140px",
          gap: theme.spacing.sm,
          alignItems: "center",
          width: "100%",
          border: "none",
          background: "none",
          padding: `${theme.spacing.sm}px`,
          borderBottom: `1px solid ${theme.colors.borderSubtle}`,
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <Badge tone={sla.tone}>{sla.label}</Badge>
        <Badge tone={status.tone}>{status.label}</Badge>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontWeight: theme.typography.subtitle.fontWeight }}>{order.title}</strong>
          <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
            {locationLabel}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>Created</span>
          <span>{formatDate(order.created_at)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>Updated</span>
          <span>{updatedLabel}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>Assignee</span>
          <span>{order.assignee_user_id ?? "Unassigned"}</span>
        </div>
      </button>
    );
  };

  const isLoading = workOrdersQuery.isLoading;
  const isError = workOrdersQuery.isError;
  const isEmpty = !isLoading && filteredOrders.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: theme.spacing.md, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, color: theme.colors.textSecondary }}>Maintenance</p>
            <h2 style={{ margin: 0 }}>Work orders</h2>
            <p style={{ margin: 0, color: theme.colors.textSecondary }}>
              Read-first dashboard for active and closed work orders. Click a row to drill in.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => router.push("/app/maintenance")}>
            View maintenance calendar
          </Button>
        </div>
        <div
          style={{
            marginTop: theme.spacing.md,
            display: "flex",
            gap: theme.spacing.sm,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <label style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
            Status
            <select
              value={statusFilter}
              onChange={(evt) => setStatusFilter(evt.target.value as StatusFilter)}
              style={{
                marginLeft: theme.spacing.xs,
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                background: theme.colors.surfaceAlt,
                color: theme.colors.textPrimary,
              }}
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="done">Closed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
            SLA
            <select
              value={slaFilter}
              onChange={(evt) => setSlaFilter(evt.target.value as SlaFilter)}
              style={{
                marginLeft: theme.spacing.xs,
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                background: theme.colors.surfaceAlt,
                color: theme.colors.textPrimary,
              }}
            >
              <option value="all">All</option>
              <option value="on_track">On track</option>
              <option value="breached">Breached</option>
            </select>
          </label>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : isError ? (
          <div style={{ color: theme.colors.error }}>Could not load work orders. Please retry shortly.</div>
        ) : isEmpty ? (
          <div style={{ color: theme.colors.textSecondary }}>No work orders match these filters.</div>
        ) : (
          <div role="table" aria-label="Work orders" style={{ width: "100%" }}>
            <div
              role="row"
              style={{
                display: "grid",
                gridTemplateColumns: "160px 140px 1fr 200px 160px 140px",
                gap: theme.spacing.sm,
                padding: `${theme.spacing.sm}px`,
                color: theme.colors.textSecondary,
                fontSize: theme.typography.caption.fontSize,
                borderBottom: `1px solid ${theme.colors.borderSubtle}`,
              }}
            >
              <span>SLA</span>
              <span>Status</span>
              <span>Title / Location</span>
              <span>Created</span>
              <span>Updated</span>
              <span>Assignee</span>
            </div>
            <div>{filteredOrders.map((order) => renderRow(order))}</div>
          </div>
        )}
      </Card>
    </div>
  );
}
