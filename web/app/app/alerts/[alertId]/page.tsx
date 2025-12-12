"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card } from "@/components/ui";
import {
  ackAlert,
  getAlert,
  listAlertRulesForDevice,
  listAlertRulesForSite,
  muteAlert,
  snoozeAlert,
} from "@/lib/api/alerts";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { useDemoStatus } from "@/lib/useDemoStatus";
import { useOrgStore } from "@/lib/orgStore";
import type { Alert, AlertRule, AlertSeverity } from "@/lib/types/alerts";
import { useUserRole } from "@/lib/useUserRole";
import { useTheme } from "@/theme/ThemeProvider";

type SnoozePreset = { minutes: number; label: string };

const SNOOZE_PRESETS: SnoozePreset[] = [
  { minutes: 15, label: "15m" },
  { minutes: 60, label: "1h" },
  { minutes: 240, label: "4h" },
  { minutes: 1440, label: "Until resolved" },
];

const formatTimestamp = (value?: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
};

const formatSnoozeLabel = (minutes: number) => {
  if (minutes >= 1440) return "Until resolved";
  if (minutes >= 60) return `${Math.round(minutes / 60)}h`;
  return `${minutes}m`;
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

function RoleRestrictedHint({ action }: { action: string }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        border: `1px dashed ${theme.colors.warning}`,
        background: theme.colors.warningSoft,
        color: theme.colors.textPrimary,
        borderRadius: theme.radius.md,
        padding: theme.spacing.sm,
      }}
    >
      <strong style={{ display: "block", marginBottom: 4 }}>Limited access</strong>
      <span style={{ color: theme.colors.textSecondary }}>Contractor roles cannot {action}. Contact an admin for access.</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>{label}</span>
      <span style={{ fontWeight: theme.typography.subtitle.fontWeight }}>{value ?? "—"}</span>
    </div>
  );
}

export default function AlertDetailPage() {
  const params = useParams<{ alertId: string }>();
  const alertId = params?.alertId;
  const { theme } = useTheme();
  const currentOrgId = useOrgStore((s) => s.currentOrgId);
  const { isContractor } = useUserRole();
  const queryClient = useQueryClient();
  const [snoozeMinutes, setSnoozeMinutes] = useState<number>(60);
  const [actionError, setActionError] = useState<string | null>(null);
  const demoStatus = useDemoStatus();
  const isDemoOrg = demoStatus.data?.isDemoOrg ?? false;

  const alertQuery = useQuery({
    queryKey: ["alert-detail", alertId, currentOrgId],
    enabled: !!alertId,
    queryFn: () => getAlert(alertId as string, currentOrgId),
  });

  const alert = alertQuery.data;
  const isResolved = alert?.status === "cleared";
  const mutedUntilDate = alert?.muted_until ? new Date(alert.muted_until) : null;
  const isMuted = mutedUntilDate ? mutedUntilDate.getTime() > Date.now() : false;

  const rulesQuery = useQuery<AlertRule[]>({
    queryKey: ["alert-rules", alert?.device_id, alert?.site_id, currentOrgId],
    enabled: Boolean(alert?.device_id || alert?.site_id),
    queryFn: () => {
      if (alert?.device_id) return listAlertRulesForDevice(alert.device_id, currentOrgId);
      if (alert?.site_id) return listAlertRulesForSite(alert.site_id, currentOrgId);
      return Promise.resolve([]);
    },
  });

  const matchingRule = useMemo(
    () => rulesQuery.data?.find((rule) => rule.id === alert?.rule_id) ?? null,
    [rulesQuery.data, alert?.rule_id],
  );

  useEffect(() => {
    if (matchingRule?.snooze_default_sec) {
      setSnoozeMinutes(Math.max(1, Math.round(matchingRule.snooze_default_sec / 60)));
    }
  }, [matchingRule]);

  const confirmDemoAction = (label: string) => {
    if (!isDemoOrg) return true;
    return window.confirm(`Demo mode: ${label}`);
  };

  const ackMutation = useMutation({
    mutationFn: () => ackAlert(alertId as string, currentOrgId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["alert-detail", alertId, currentOrgId], updated);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      setActionError(null);
    },
    onError: () => setActionError("Failed to acknowledge alert. Please try again."),
  });

  const snoozeMutation = useMutation({
    mutationFn: (minutes: number) => snoozeAlert(alertId as string, currentOrgId, minutes),
    onSuccess: (updated) => {
      queryClient.setQueryData(["alert-detail", alertId, currentOrgId], updated);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      setActionError(null);
    },
    onError: () => setActionError("Failed to snooze alert. Please try again."),
  });

  const muteMutation = useMutation({
    mutationFn: (minutes: number) => muteAlert(alertId as string, currentOrgId, minutes),
    onSuccess: (updated) => {
      queryClient.setQueryData(["alert-detail", alertId, currentOrgId], updated);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      setActionError(null);
    },
    onError: () => setActionError("Failed to update mute status. Please try again."),
  });

  const ackDisabled = isContractor || !alert || ackMutation.isPending;
  const snoozeDisabled = isContractor || !alert || snoozeMutation.isPending || isResolved;
  const muteDisabled = isContractor || !alert || muteMutation.isPending || isResolved;

  const onAcknowledge = () => {
    if (!alert || isContractor) return;
    if (!confirmDemoAction("Acknowledge this alert?")) return;
    setActionError(null);
    ackMutation.mutate();
  };

  const onSnooze = () => {
    if (!alert || isContractor || isResolved) return;
    if (!confirmDemoAction("Snooze this alert?")) return;
    setActionError(null);
    snoozeMutation.mutate(snoozeMinutes);
  };

  const onToggleMute = () => {
    if (!alert || isContractor || isResolved) return;
    if (!confirmDemoAction(isMuted ? "Unmute this alert?" : "Mute this alert for 24h?")) return;
    setActionError(null);
    const minutes = isMuted ? 1 : 1440;
    muteMutation.mutate(minutes);
  };

  if (!alertId) {
    return (
      <Card>
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>No alert selected.</p>
      </Card>
    );
  }

  if (alertQuery.isLoading) {
    return (
      <Card>
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>Loading alert details...</p>
      </Card>
    );
  }

  if (alertQuery.isError || !alert) {
    return (
      <Card title="Alert unavailable">
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>Unable to load this alert. It may have been removed.</p>
        <Link href="/app/alerts" style={{ color: theme.colors.primary }}>
          Back to alerts
        </Link>
      </Card>
    );
  }

  const statusLabel = alert.status === "cleared" ? "Resolved" : "Open";
  const statusTone = alert.status === "cleared" ? "success" : "warning";
  const ackLabel = alert.acknowledged_at ? `Acknowledged ${formatRelativeTime(alert.acknowledged_at, "recently")}` : "Not acknowledged";
  const mutedLabel =
    isMuted && mutedUntilDate
      ? `Muted until ${formatTimestamp(alert.muted_until)}`
      : "Not muted";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: theme.spacing.md, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
            <div style={{ display: "flex", gap: theme.spacing.sm, alignItems: "center", flexWrap: "wrap" }}>
              <SeverityPill severity={alert.severity} />
              <Badge tone={statusTone}>{statusLabel}</Badge>
              <Badge tone="info">{alert.type?.toUpperCase() || "ALERT"}</Badge>
            </div>
            <h2 style={{ margin: 0 }}>{alert.rule_name || alert.message || "Alert"}</h2>
            <p style={{ margin: 0, color: theme.colors.textSecondary }}>
              Device: {alert.device_name || alert.device_id || "Unknown device"} • Site: {alert.site_name || alert.site_id || "Unknown site"}
            </p>
            <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
              Created {formatRelativeTime(alert.first_seen_at, "Unknown")} • Last triggered {formatRelativeTime(alert.last_seen_at, "Unknown")}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs, alignItems: "flex-end" }}>
            <Badge tone={alert.acknowledged_at ? "success" : "neutral"}>{ackLabel}</Badge>
            <Badge tone={isMuted ? "warning" : "neutral"}>{mutedLabel}</Badge>
          </div>
        </div>
      </Card>

      <Card title="Quick actions" subtitle={isResolved ? "Alert is resolved; snoozes will clear when it reopens." : undefined}>
        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
          {isContractor ? <RoleRestrictedHint action="acknowledge or mute alerts" /> : null}
          <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
            <Button size="sm" onClick={onAcknowledge} disabled={ackDisabled || isResolved}>
              {ackMutation.isPending ? "Acknowledging..." : "Acknowledge"}
            </Button>
            <div style={{ display: "flex", gap: theme.spacing.xs, alignItems: "center", flexWrap: "wrap" }}>
              {SNOOZE_PRESETS.map((preset) => {
                const selected = preset.minutes === snoozeMinutes;
                return (
                  <Button
                    key={preset.minutes}
                    size="sm"
                    variant={selected ? "primary" : "secondary"}
                    onClick={() => setSnoozeMinutes(preset.minutes)}
                    disabled={isContractor || isResolved}
                  >
                    {preset.label}
                  </Button>
                );
              })}
              <Button
                size="sm"
                variant="secondary"
                onClick={onSnooze}
                disabled={snoozeDisabled}
              >
                {snoozeMutation.isPending ? "Applying..." : `Snooze ${formatSnoozeLabel(snoozeMinutes)}`}
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleMute}
              disabled={muteDisabled}
            >
              {muteMutation.isPending ? "Updating..." : isMuted ? "Unmute" : "Mute for 24h"}
            </Button>
          </div>
          {actionError ? <span style={{ color: theme.colors.error }}>{actionError}</span> : null}
        </div>
      </Card>

      <Card title="Details">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: theme.spacing.md,
          }}
        >
          <InfoRow label="First seen" value={formatTimestamp(alert.first_seen_at)} />
          <InfoRow label="Last seen" value={formatTimestamp(alert.last_seen_at)} />
          <InfoRow label="Acknowledged by" value={alert.acknowledged_by || "Not yet"} />
          <InfoRow label="Muted until" value={isMuted && alert.muted_until ? formatTimestamp(alert.muted_until) : "Not muted"} />
          <InfoRow label="Rule" value={alert.rule_name || matchingRule?.name || alert.rule_id || "Not linked"} />
          <InfoRow label="Rule severity" value={matchingRule?.severity ?? alert.severity} />
        </div>
        <div style={{ marginTop: theme.spacing.sm }}>
          {rulesQuery.isLoading ? (
            <p style={{ color: theme.colors.textSecondary }}>Loading rule details...</p>
          ) : matchingRule ? (
            <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
              <span style={{ color: theme.colors.textSecondary }}>
                Metric: {matchingRule.metric} ({matchingRule.rule_type})
              </span>
              {matchingRule.threshold != null ? (
                <span style={{ color: theme.colors.textSecondary }}>Threshold: {matchingRule.threshold}</span>
              ) : null}
              {matchingRule.offline_grace_sec ? (
                <span style={{ color: theme.colors.textSecondary }}>
                  Offline grace: {Math.round(matchingRule.offline_grace_sec / 60)}m
                </span>
              ) : null}
              {matchingRule.snooze_default_sec ? (
                <span style={{ color: theme.colors.textSecondary }}>
                  Default snooze: {formatSnoozeLabel(Math.max(1, Math.round(matchingRule.snooze_default_sec / 60)))}
                </span>
              ) : null}
            </div>
          ) : (
            <p style={{ color: theme.colors.textSecondary }}>No matching rule metadata found for this alert.</p>
          )}
        </div>
      </Card>

      <Card title="Next steps">
        <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
          {alert.device_id ? (
            <Button as="a" href={`/app/devices/${alert.device_id}?range=24h`} variant="secondary">
              View device
            </Button>
          ) : (
            <Button variant="secondary" disabled>
              View device
            </Button>
          )}
          <Button
            variant="secondary"
            disabled
            title="Work order creation will be wired next"
          >
            Create work order
          </Button>
          <Link href="/app/alerts" style={{ color: theme.colors.primary, alignSelf: "center" }}>
            Back to alerts
          </Link>
        </div>
      </Card>
    </div>
  );
}
