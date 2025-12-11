"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card } from "@/components/ui";
import { listAlerts } from "@/lib/api/alerts";
import { fetchHealthPlus } from "@/lib/api/healthPlus";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { useOrgStore } from "@/lib/orgStore";
import type { Alert, AlertSeverity } from "@/lib/types/alerts";
import type { HealthPlusPayload } from "@/lib/types/health";
import { useTheme } from "@/theme/ThemeProvider";

type StatusFilter = "open" | "resolved" | "all";
type SeverityFilter = "all" | AlertSeverity;

const formatTimestamp = (value?: string | null, fallback = "Unknown") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString();
};

function SeverityPill({ severity }: { severity: AlertSeverity }) {
  const { theme } = useTheme();
  const palette =
    severity === "critical"
      ? { bg: theme.colors.errorSoft, fg: theme.colors.error }
      : severity === "warning"
        ? { bg: theme.colors.warningSoft, fg: theme.colors.warning }
        : { bg: theme.colors.infoSoft, fg: theme.colors.info };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
        borderRadius: theme.radius.pill,
        backgroundColor: palette.bg,
        color: palette.fg,
        fontWeight: theme.typography.label.fontWeight,
        border: `1px solid ${palette.fg}`,
      }}
    >
      {severity.toUpperCase()}
    </span>
  );
}

function InlineBanner({ tone = "warning", title, message }: { tone?: "warning" | "error" | "info"; title: string; message: string }) {
  const { theme } = useTheme();
  const palette =
    tone === "error"
      ? { bg: theme.colors.errorSoft, fg: theme.colors.error }
      : tone === "info"
        ? { bg: theme.colors.infoSoft, fg: theme.colors.info }
        : { bg: theme.colors.warningSoft, fg: theme.colors.warning };

  return (
    <div
      style={{
        border: `1px solid ${palette.fg}`,
        background: palette.bg,
        color: palette.fg,
        borderRadius: theme.radius.md,
        padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
      }}
    >
      <strong style={{ display: "block", marginBottom: 4 }}>{title}</strong>
      <span style={{ color: theme.colors.textPrimary }}>{message}</span>
    </div>
  );
}

function ListSkeleton() {
  const { theme } = useTheme();
  return (
    <div data-testid="alerts-skeleton" style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
      {Array.from({ length: 5 }).map((_, idx) => (
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: "140px 120px 1fr 220px 180px 120px",
            gap: theme.spacing.sm,
            alignItems: "center",
          }}
        >
          {Array.from({ length: 6 }).map((__, col) => (
            <div
              key={col}
              style={{
                height: 16,
                borderRadius: theme.radius.sm,
                background: theme.colors.backgroundAlt,
                animation: "pulse 1.2s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ))}
      <style>{`@keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }`}</style>
    </div>
  );
}

export default function AlertsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const currentOrgId = useOrgStore((s) => s.currentOrgId);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  const alertsQuery = useQuery({
    queryKey: ["alerts", statusFilter, severityFilter, currentOrgId],
    queryFn: () =>
      listAlerts({
        orgId: currentOrgId ?? undefined,
        status: statusFilter === "open" ? "active" : statusFilter === "resolved" ? "cleared" : "all",
        severity: severityFilter === "all" ? undefined : severityFilter,
        limit: 200,
      }),
  });

  const healthQuery = useQuery<HealthPlusPayload>({
    queryKey: ["health-plus"],
    queryFn: fetchHealthPlus,
    staleTime: 5 * 60 * 1000,
  });

  const healthBanner = useMemo(() => {
    const vendorDisabled = healthQuery.data?.vendorFlags?.disabled?.some((flag) =>
      flag.toLowerCase().includes("alert"),
    );
    const workerUnhealthy = healthQuery.data?.alertsWorker?.healthy === false;
    if (vendorDisabled) {
      return { tone: "warning" as const, title: "Alerts worker disabled", message: "Alerts are currently disabled for this environment. Data may be stale." };
    }
    if (workerUnhealthy) {
      const lastHeartbeat = healthQuery.data?.alertsWorker?.lastHeartbeatAt
        ? formatTimestamp(healthQuery.data?.alertsWorker?.lastHeartbeatAt, "recently")
        : "recently";
      return {
        tone: "warning" as const,
        title: "Alerts worker is unhealthy",
        message: `Latest heartbeat ${lastHeartbeat}. Alert freshness may be impacted.`,
      };
    }
    return null;
  }, [healthQuery.data]);

  const alerts = alertsQuery.data ?? [];
  const isLoading = alertsQuery.isLoading;
  const isError = alertsQuery.isError;
  const isEmpty = !isLoading && alerts.length === 0;

  const renderRow = (alert: Alert) => {
    const statusLabel = alert.status === "cleared" ? "Resolved" : "Open";
    const statusTone = alert.status === "cleared" ? "success" : "warning";
    const alertTitle = alert.rule_name || alert.message || "Alert";
    const deviceLabel = alert.device_name || alert.device_id || "Device unknown";
    const siteLabel = alert.site_name || alert.site_id || "Site unknown";
    const mutedUntil = alert.muted_until ? formatTimestamp(alert.muted_until) : null;
    const mutedBadge =
      mutedUntil && new Date(alert.muted_until).getTime() > Date.now()
        ? `Muted until ${mutedUntil}`
        : null;

    return (
      <div
        key={alert.id}
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/app/alerts/${alert.id}`)}
        onKeyDown={(evt) => {
          if (evt.key === "Enter" || evt.key === " ") {
            evt.preventDefault();
            router.push(`/app/alerts/${alert.id}`);
          }
        }}
        style={{
          display: "grid",
          gridTemplateColumns: "140px 120px 1fr 220px 180px 120px",
          gap: theme.spacing.sm,
          alignItems: "center",
          padding: `${theme.spacing.sm}px ${theme.spacing.sm}px`,
          borderBottom: `1px solid ${theme.colors.borderSubtle}`,
          backgroundColor: theme.colors.surface,
          cursor: "pointer",
        }}
      >
        <SeverityPill severity={alert.severity} />
        <Badge tone={statusTone}>{statusLabel}</Badge>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <strong style={{ fontWeight: theme.typography.subtitle.fontWeight }}>{alertTitle}</strong>
          <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
            {(alert.type || "Alert").toUpperCase()} • Updated {formatRelativeTime(alert.last_seen_at, "Unknown")}
          </span>
          {mutedBadge ? (
            <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>{mutedBadge}</span>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, color: theme.colors.textSecondary }}>
          <span>{deviceLabel}</span>
          <span>{siteLabel}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ color: theme.colors.textPrimary }}>Created {formatRelativeTime(alert.first_seen_at, "Unknown")}</span>
          <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
            {formatTimestamp(alert.first_seen_at)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              router.push(`/app/alerts/${alert.id}`);
            }}
          >
            View
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
      {healthBanner ? (
        <InlineBanner tone={healthBanner.tone} title={healthBanner.title} message={healthBanner.message} />
      ) : null}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: theme.spacing.md, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>Alerts</h2>
            <p style={{ margin: 0, color: theme.colors.textSecondary }}>
              Live alerts from your organisation. Click a row to open full details.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
            <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
              Status filter
            </span>
            <div style={{ display: "flex", gap: theme.spacing.xs }}>
              {(["open", "resolved", "all"] as StatusFilter[]).map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={statusFilter === status ? "primary" : "secondary"}
                  onClick={() => setStatusFilter(status)}
                >
                  {status === "open" ? "Open" : status === "resolved" ? "Resolved" : "All"}
                </Button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
            <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
              Severity filter
            </span>
            <div style={{ display: "flex", gap: theme.spacing.xs, flexWrap: "wrap" }}>
              {(["all", "critical", "warning", "info"] as SeverityFilter[]).map((sev) => (
                <Button
                  key={sev}
                  size="sm"
                  variant={severityFilter === sev ? "primary" : "secondary"}
                  onClick={() => setSeverityFilter(sev)}
                >
                  {sev === "all" ? "All" : sev.charAt(0).toUpperCase() + sev.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: theme.spacing.md }}>
          {isLoading ? (
            <ListSkeleton />
          ) : isError ? (
            <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
              <InlineBanner tone="error" title="Could not load alerts" message="Network error or alerts service unavailable." />
              <Button size="sm" variant="secondary" onClick={() => alertsQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : isEmpty ? (
            <InlineBanner
              tone="info"
              title="No alerts to show"
              message={
                severityFilter === "all" && statusFilter !== "resolved"
                  ? "No open alerts for this organisation."
                  : "No alerts match the selected filters."
              }
            />
          ) : (
            <div
              style={{
                border: `1px solid ${theme.colors.borderSubtle}`,
                borderRadius: theme.radius.lg,
                overflow: "hidden",
                boxShadow: `0 6px 18px ${theme.colors.shadow}`,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 120px 1fr 220px 180px 120px",
                  gap: theme.spacing.sm,
                  padding: `${theme.spacing.sm}px ${theme.spacing.sm}px`,
                  backgroundColor: theme.colors.surfaceAlt,
                  borderBottom: `1px solid ${theme.colors.borderSubtle}`,
                  fontWeight: 600,
                }}
              >
                <span>Severity</span>
                <span>Status</span>
                <span>Alert</span>
                <span>Device / Site</span>
                <span>Created</span>
                <span style={{ textAlign: "right" }}>Actions</span>
              </div>
              <div>{alerts.map((alert) => renderRow(alert))}</div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
