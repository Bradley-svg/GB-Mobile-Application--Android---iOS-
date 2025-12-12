"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, StatusPill } from "@/components/ui";
import type { StatusKind } from "@/components/ui/StatusPill";
import { fetchHealthPlus } from "@/lib/api/healthPlus";
import type { HealthPlusPayload } from "@/lib/types/healthPlus";
import { useUserRole } from "@/lib/useUserRole";
import { useTheme } from "@/theme/ThemeProvider";

type DerivedStatus = "healthy" | "disabled" | "unconfigured" | "failing" | "unknown";

type Subsystem = {
  key: string;
  title: string;
  status: DerivedStatus;
  note?: string | null;
  rows: Array<{ label: string; value: string }>;
};

const STATUS_META: Record<DerivedStatus, { label: string; tone: "success" | "warning" | "error" | "neutral" }> = {
  healthy: { label: "Healthy", tone: "success" },
  disabled: { label: "Disabled", tone: "warning" },
  unconfigured: { label: "Unconfigured", tone: "warning" },
  failing: { label: "Failing", tone: "error" },
  unknown: { label: "Unknown", tone: "neutral" },
};
const STATUS_KIND_MAP: Record<DerivedStatus, StatusKind> = {
  healthy: "healthy",
  disabled: "unconfigured",
  unconfigured: "unconfigured",
  failing: "critical",
  unknown: "info",
};

const formatTime = (iso?: string | null) => {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
};

const formatLatency = (ms?: number | null) => {
  if (ms === null || ms === undefined) return "N/A";
  const rounded = Math.round(ms);
  return `${rounded} ms`;
};

const statusFromFlags = ({
  healthy,
  configured,
  disabled,
}: {
  healthy?: boolean;
  configured?: boolean;
  disabled?: boolean;
}): DerivedStatus => {
  if (disabled) return "disabled";
  if (configured === false) return "unconfigured";
  if (healthy === false) return "failing";
  if (healthy === true) return "healthy";
  return "unknown";
};

const StatusBadge = ({ status, testId }: { status: DerivedStatus; testId?: string }) => {
  const meta = STATUS_META[status];
  const mapped = STATUS_KIND_MAP[status];
  return <StatusPill status={mapped} label={meta.label} subdued data-testid={testId} />;
};

const InfoRow = ({ label, value }: { label: string; value: string }) => {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: theme.spacing.sm }}>
      <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>{label}</span>
      <span style={{ fontWeight: 600, color: theme.colors.textPrimary, textAlign: "right" }}>{value}</span>
    </div>
  );
};

const SubsystemCard = ({ subsystem }: { subsystem: Subsystem }) => {
  const { theme } = useTheme();
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: theme.spacing.sm }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h3 style={{ margin: 0 }}>{subsystem.title}</h3>
          {subsystem.note ? (
            <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
              {subsystem.note}
            </span>
          ) : null}
        </div>
        <StatusBadge status={subsystem.status} testId={`diag-${subsystem.key}-status`} />
      </div>
      <div style={{ marginTop: theme.spacing.md, display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
        {subsystem.rows.map((row) => (
          <InfoRow key={`${subsystem.key}-${row.label}`} label={row.label} value={row.value} />
        ))}
      </div>
    </Card>
  );
};

export default function DiagnosticsPage() {
  const { theme } = useTheme();
  const { isOwner, isAdmin, isFacilities } = useUserRole();
  const allowed = isOwner || isAdmin || isFacilities;
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const healthQuery = useQuery<HealthPlusPayload>({
    queryKey: ["health-plus"],
    queryFn: fetchHealthPlus,
    staleTime: 5 * 60 * 1000,
    enabled: allowed,
  });

  const health = healthQuery.data;
  const vendorDisableSet = useMemo(
    () => new Set((health?.vendorFlags?.disabled ?? []).map((flag) => flag.toUpperCase())),
    [health?.vendorFlags?.disabled],
  );

  const subsystemCards: Subsystem[] = useMemo(() => {
    if (!health) return [];

    const vendorDisabled = (flag: string | string[], explicit?: boolean) => {
      const flags = Array.isArray(flag) ? flag : [flag];
      return explicit || flags.some((f) => vendorDisableSet.has(f.toUpperCase()));
    };

    const controlDisabled = vendorDisabled("CONTROL_API_DISABLED", health.vendorFlags?.controlDisabled || health.control.disabled);
    const mqttDisabled = vendorDisabled("MQTT_DISABLED", health.vendorFlags?.mqttDisabled || health.mqtt.disabled);
    const historyDisabled = vendorDisabled("HEATPUMP_HISTORY_DISABLED", health.vendorFlags?.heatPumpHistoryDisabled || health.heatPumpHistory.disabled);
    const pushDisabled = vendorDisabled("PUSH_NOTIFICATIONS_DISABLED", health.vendorFlags?.pushNotificationsDisabled || health.push.disabled);

    const antivirusHealthy =
      health.antivirus.enabled &&
      !["infected", "error", "scan_failed"].includes(health.antivirus.lastResult ?? "") &&
      !health.antivirus.lastError;

    return [
      {
        key: "db",
        title: "Database",
        status: statusFromFlags({ healthy: health.db === "ok" }),
        rows: [
          { label: "Status", value: health.db === "ok" ? "OK" : "Error" },
          { label: "Latency", value: formatLatency(health.dbLatencyMs) },
        ],
      },
      {
        key: "storage",
        title: "Storage",
        status: statusFromFlags({ healthy: health.storage?.writable, configured: Boolean(health.storage) }),
        rows: [
          { label: "Root", value: health.storage?.root ?? "Unknown" },
          { label: "Writable", value: health.storage?.writable ? "Yes" : "No" },
          { label: "Latency", value: formatLatency(health.storage?.latencyMs) },
        ],
      },
      {
        key: "antivirus",
        title: "Antivirus",
        status: statusFromFlags({
          healthy: antivirusHealthy,
          configured: health.antivirus.configured,
          disabled: !health.antivirus.enabled,
        }),
        rows: [
          { label: "Mode", value: health.antivirus.target ?? "Unknown" },
          { label: "Last run", value: formatTime(health.antivirus.lastRunAt) },
          { label: "Last result", value: (health.antivirus.lastResult ?? "Unknown").replace("_", " ") },
          { label: "Latency", value: formatLatency(health.antivirus.latencyMs) },
          { label: "Last error", value: health.antivirus.lastError || "None" },
        ],
      },
      {
        key: "control",
        title: "Control",
        status: statusFromFlags({
          healthy: health.control.healthy,
          configured: health.control.configured,
          disabled: controlDisabled,
        }),
        note: controlDisabled ? "Disabled for this environment" : null,
        rows: [
          { label: "Latency", value: formatLatency(null) },
          { label: "Last command", value: formatTime(health.control.lastCommandAt) },
          { label: "Last error", value: health.control.lastError || "None" },
        ],
      },
      {
        key: "mqtt",
        title: "MQTT ingest",
        status: statusFromFlags({
          healthy: health.mqtt.healthy,
          configured: health.mqtt.configured,
          disabled: mqttDisabled,
        }),
        note: mqttDisabled ? "Disabled for this environment" : null,
        rows: [
          { label: "Connected", value: health.mqtt.connected ? "Yes" : "No" },
          { label: "Latency", value: formatLatency(null) },
          { label: "Last ingest", value: formatTime(health.mqtt.lastIngestAt) },
          { label: "Last error", value: health.mqtt.lastError || "None" },
        ],
      },
      {
        key: "heat",
        title: "Heat pump history",
        status: statusFromFlags({
          healthy: health.heatPumpHistory.healthy,
          configured: health.heatPumpHistory.configured,
          disabled: historyDisabled,
        }),
        note: historyDisabled ? "Disabled for this environment" : null,
        rows: [
          { label: "Latency", value: formatLatency(null) },
          { label: "Last success", value: formatTime(health.heatPumpHistory.lastSuccessAt) },
          { label: "Last check", value: formatTime(health.heatPumpHistory.lastCheckAt) },
          { label: "Last error", value: health.heatPumpHistory.lastError || "None" },
        ],
      },
      {
        key: "push",
        title: "Push notifications",
        status: statusFromFlags({
          healthy: health.push.enabled && !health.push.lastError,
          configured: health.push.enabled,
          disabled: pushDisabled,
        }),
        note: pushDisabled ? "Disabled for this environment" : null,
        rows: [
          { label: "Latency", value: formatLatency(null) },
          { label: "Enabled", value: health.push.enabled ? "Yes" : "No" },
          { label: "Last sample", value: formatTime(health.push.lastSampleAt) },
          { label: "Last error", value: health.push.lastError || "None" },
        ],
      },
      {
        key: "alerts-worker",
        title: "Alerts worker",
        status: statusFromFlags({ healthy: health.alertsWorker.healthy }),
        rows: [
          { label: "Latency", value: formatLatency(null) },
          { label: "Last heartbeat", value: formatTime(health.alertsWorker.lastHeartbeatAt) },
        ],
      },
    ];
  }, [health, vendorDisableSet]);

  const overall = useMemo(() => {
    const statuses = subsystemCards.map((s) => s.status);
    const hasFailing = statuses.includes("failing") || health?.ok === false;
    const hasDegraded = statuses.some((s) => s === "disabled" || s === "unconfigured" || s === "unknown");
    if (!health) return { label: "Unknown", tone: "neutral" as const };
    if (hasFailing) return { label: "Failing", tone: "error" as const };
    if (hasDegraded) return { label: "Degraded", tone: "warning" as const };
    return { label: "OK", tone: "success" as const };
  }, [health, subsystemCards]);

  const alertsEngine = health?.alertsEngine;
  const lastSample = healthQuery.dataUpdatedAt ? new Date(healthQuery.dataUpdatedAt).toLocaleString() : "Not sampled yet";

  const handleCopy = async () => {
    if (!health) return;
    const payload = JSON.stringify(health, null, 2);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = payload;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("idle");
    }
  };

  if (!allowed) {
    return (
      <Card title="Diagnostics unavailable">
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>
          Diagnostics are limited to owner, admin, or facilities roles.
        </p>
      </Card>
    );
  }

  if (healthQuery.isLoading) {
    return (
      <Card title="Diagnostics">
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>Loading /health-plus snapshot...</p>
      </Card>
    );
  }

  if (healthQuery.isError || !health) {
    return (
      <Card title="Diagnostics">
        <p style={{ margin: 0, color: theme.colors.error }}>Could not load /health-plus. Please retry.</p>
        <Button size="sm" variant="secondary" onClick={() => healthQuery.refetch()} style={{ marginTop: theme.spacing.sm }}>
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.lg }}>
      <Card
        title="Diagnostics"
        subtitle="Snapshot of /health-plus for support and operational visibility."
        actions={
          <div style={{ display: "flex", gap: theme.spacing.sm, alignItems: "center" }}>
            {copyState === "copied" ? (
              <span style={{ color: theme.colors.success, fontSize: theme.typography.caption.fontSize }}>Copied</span>
            ) : null}
            <Button size="sm" variant="secondary" onClick={handleCopy} data-testid="diagnostics-copy-json">
              Copy JSON
            </Button>
          </div>
        }
      >
        <div
          style={{
            marginTop: theme.spacing.md,
            display: "grid",
            gap: theme.spacing.md,
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
        >
          <div
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.borderSubtle}`,
              backgroundColor: theme.colors.surface,
            }}
          >
            <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>Overall health</span>
            <div style={{ marginTop: theme.spacing.xs }}>
              <Badge tone={overall.tone === "neutral" ? "neutral" : overall.tone}>{overall.label}</Badge>
            </div>
          </div>
          <div
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.borderSubtle}`,
              backgroundColor: theme.colors.surface,
            }}
          >
            <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
              Last /health-plus
            </span>
            <div style={{ marginTop: theme.spacing.xs, fontWeight: 600 }}>{lastSample}</div>
          </div>
          <div
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.borderSubtle}`,
              backgroundColor: theme.colors.surface,
            }}
          >
            <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>Alerts engine</span>
            <div style={{ marginTop: theme.spacing.xs, display: "flex", flexDirection: "column", gap: 4 }}>
              <span>Last run: {formatTime(alertsEngine?.lastRunAt)}{alertsEngine?.lastDurationMs ? ` (${alertsEngine.lastDurationMs}ms)` : ""}</span>
              <span>Rules loaded: {alertsEngine?.rulesLoaded ?? 0}</span>
              <span>
                Active: {alertsEngine?.activeAlertsTotal ?? 0} (crit {alertsEngine?.activeCritical ?? 0} / warn{" "}
                {alertsEngine?.activeWarning ?? 0} / info {alertsEngine?.activeInfo ?? 0})
              </span>
            </div>
          </div>
          {health.perfHints ? (
            <div
              style={{
                padding: theme.spacing.md,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                backgroundColor: theme.colors.surface,
              }}
            >
              <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
                Fleet size & load
              </span>
              <div style={{ marginTop: theme.spacing.xs, display: "flex", flexDirection: "column", gap: 4 }}>
                <span>Devices: {health.perfHints.deviceCount.toLocaleString()}</span>
                <span>
                  Alerts/device: {health.perfHints.avgAlertsPerDevice.toFixed(2)} (total{" "}
                  {health.perfHints.alertCount.toLocaleString()})
                </span>
                <span>
                  Work orders/device: {health.perfHints.avgWorkOrdersPerDevice.toFixed(2)} (total{" "}
                  {health.perfHints.workOrderCount.toLocaleString()})
                </span>
                <span>
                  Slow queries (last hour):{" "}
                  {health.perfHints.slowQueriesLastHour == null
                    ? "Not tracked"
                    : health.perfHints.slowQueriesLastHour.toLocaleString()}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <div
        style={{
          display: "grid",
          gap: theme.spacing.md,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        {subsystemCards.map((subsystem) => (
          <div key={subsystem.key} data-testid={`diag-${subsystem.key}-card`}>
            <SubsystemCard subsystem={subsystem} />
          </div>
        ))}
      </div>
    </div>
  );
}
