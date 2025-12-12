ï»¿"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card, StatusPill } from "@/components/ui";
import { fetchDeviceTelemetry } from "@/lib/api/devices";
import { fetchFleet } from "@/lib/api/fleet";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { ApiDevice, FleetSearchResult, LastSeenSummary } from "@/lib/types/fleet";
import type { DeviceTelemetry } from "@/lib/types/telemetry";
import { useTheme } from "@/theme/ThemeProvider";
import { useOrgStore } from "@/lib/orgStore";
import type { StatusKind } from "@/components/ui/StatusPill";

type MetricValue = string | number | null | undefined;
const DASHBOARD_STALE_TIME = 30_000;
const DASHBOARD_CACHE_TIME = 5 * 60 * 1000;
const DEGREE = "\u00b0C";

const metricKeys = {
  tank: ["tank_temp", "tank_temp_c", "supply_temp"],
  dhw: ["dhw_temp", "dhw_temp_c", "return_temp"],
  ambient: ["ambient_temp", "outdoor_temp", "ambient"],
  compressor: ["compressor_current", "compressor_current_a"],
  eev: ["eev_steps", "eev"],
  mode: ["mode"],
  defrost: ["defrost"],
};

const pickLatestMetric = (telemetry?: DeviceTelemetry | null, keys: string[] = []) => {
  if (!telemetry) return null;
  for (const key of keys) {
    const points = telemetry.metrics[key] ?? [];
    if (points.length > 0) {
      const latest = points[points.length - 1];
      if (latest?.value !== undefined && latest?.value !== null) {
        return latest.value;
      }
    }
  }
  return null;
};

const formatLastSeen = (lastSeen?: LastSeenSummary | null, fallbackIso?: string | null) => {
  if (lastSeen?.ageMinutes !== null && lastSeen?.ageMinutes !== undefined) {
    const minutes = lastSeen.ageMinutes;
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${Math.round(minutes)} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return formatRelativeTime(fallbackIso, "Unknown");
};

const formatMetricValue = (value: MetricValue, suffix = "") => {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "number") {
    const rounded = Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
    return `${rounded}${suffix}`;
  }
  return `${value}${suffix}`;
};

const deriveStatus = (device: ApiDevice, isOffline: boolean): StatusKind => {
  if (isOffline) return "offline";
  if (device.health === "critical") return "critical";
  if (device.health === "warning") return "warning";
  if (device.health === "healthy") return "healthy";
  if ((device.status || "").toLowerCase().includes("unconfig")) return "unconfigured";
  return "info";
};

function FleetDeviceCard({ device }: { device: ApiDevice }) {
  const { theme } = useTheme();
  const currentOrgId = useOrgStore((s) => s.currentOrgId);
  const status = (device.status || "").toLowerCase();
  const isOffline = device.health === "offline" || device.last_seen?.isOffline || status.includes("off");
  const statusKind = deriveStatus(device, isOffline);

  const telemetryQuery = useQuery({
    queryKey: ["device-telemetry", device.id, currentOrgId],
    queryFn: () => fetchDeviceTelemetry(device.id, "1h", currentOrgId),
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_CACHE_TIME,
  });

  const telemetry = telemetryQuery.data;
  const metrics = {
    tank: pickLatestMetric(telemetry, metricKeys.tank),
    dhw: pickLatestMetric(telemetry, metricKeys.dhw),
    ambient: pickLatestMetric(telemetry, metricKeys.ambient),
    compressor: pickLatestMetric(telemetry, metricKeys.compressor),
    eev: pickLatestMetric(telemetry, metricKeys.eev),
    mode: pickLatestMetric(telemetry, metricKeys.mode),
    defrost: pickLatestMetric(telemetry, metricKeys.defrost),
  };

  const renderMetric = (label: string, value: MetricValue, suffix = "") => (
    <div
      style={{
        padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.colors.borderSubtle}`,
        backgroundColor: theme.colors.surface,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: `0 8px 18px ${theme.colors.shadow}`,
      }}
    >
      <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>{label}</span>
      <strong style={{ fontSize: theme.typography.subtitle.fontSize, fontWeight: theme.typography.subtitle.fontWeight }}>
        {formatMetricValue(value, suffix)}
      </strong>
    </div>
  );

  return (
    <Link
      href={`/app/devices/${device.id}`}
      style={{
        textDecoration: "none",
        color: theme.colors.textPrimary,
      }}
    >
      <div
        style={{
          border: `1px solid ${theme.colors.borderSubtle}`,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.card,
          padding: theme.spacing.xl,
          boxShadow: `0 14px 32px ${theme.colors.shadow}`,
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing.lg,
          minHeight: 260,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: theme.spacing.lg, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize, letterSpacing: 0.4 }}>
              Heat pump
            </span>
            <span style={{ fontWeight: theme.typography.subtitle.fontWeight, fontSize: theme.typography.title2.fontSize }}>
              {device.name}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" }}>
              <span style={{ color: theme.colors.textSecondary, fontFamily: "monospace" }}>{device.mac || "MAC unknown"}</span>
              <Badge tone="brand">{device.site_name || "Unknown site"}</Badge>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" }}>
              <Badge tone="info">Last seen {formatLastSeen(device.last_seen, device.last_seen_at ?? undefined)}</Badge>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" }}>
            <StatusPill status={statusKind} />
            <Badge tone={isOffline ? "error" : "success"}>{isOffline ? "Offline" : "Connected"}</Badge>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: theme.spacing.sm,
          }}
        >
          {renderMetric("Tank degC", metrics.tank, typeof metrics.tank === "number" ? DEGREE : "")}
          {renderMetric("DHW degC", metrics.dhw, typeof metrics.dhw === "number" ? DEGREE : "")}
          {renderMetric("Ambient degC", metrics.ambient, typeof metrics.ambient === "number" ? DEGREE : "")}
          {renderMetric("Compressor A", metrics.compressor)}
          {renderMetric("EEV steps", metrics.eev)}
          {renderMetric("Mode", metrics.mode)}
          {renderMetric("Defrost", metrics.defrost)}
        </div>

        {telemetryQuery.isLoading ? (
          <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
            Loading metrics...
          </span>
        ) : telemetryQuery.isError ? (
          <span style={{ color: theme.colors.error, fontSize: theme.typography.caption.fontSize }}>
            Could not load metrics. Tap to view details.
          </span>
        ) : null}
      </div>
    </Link>
  );
}

const ListSkeleton = () => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        display: "grid",
        gap: theme.spacing.md,
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
      }}
    >
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          style={{
            border: `1px solid ${theme.colors.borderSubtle}`,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.card,
            padding: theme.spacing.xl,
            minHeight: 260,
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.sm,
            animation: "pulse 1.6s ease-in-out infinite",
            opacity: 0.85,
          }}
        >
          <div style={{ height: 12, width: "48%", background: theme.colors.backgroundAlt, borderRadius: theme.radius.sm }} />
          <div style={{ height: 10, width: "60%", background: theme.colors.backgroundAlt, borderRadius: theme.radius.sm }} />
          <div style={{ height: 10, width: "32%", background: theme.colors.backgroundAlt, borderRadius: theme.radius.sm }} />
          <div style={{ height: 120, background: theme.colors.backgroundAlt, borderRadius: theme.radius.md }} />
        </div>
      ))}
      <style>{`@keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }`}</style>
    </div>
  );
};

export default function FleetOverviewPage() {
  const { theme } = useTheme();
  const currentOrgId = useOrgStore((s) => s.currentOrgId);
  const [selectedSiteId, setSelectedSiteId] = useState<string | "all">("all");

  const fleetQuery = useQuery<FleetSearchResult>({
    queryKey: ["fleet", selectedSiteId, currentOrgId],
    queryFn: () => fetchFleet({ orgId: currentOrgId ?? undefined }),
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_CACHE_TIME,
  });

  const sites = fleetQuery.data?.sites ?? [];

  const filteredDevices = useMemo(() => {
    const devices = fleetQuery.data?.devices ?? [];
    if (selectedSiteId === "all") return devices;
    return devices.filter((d) => d.site_id === selectedSiteId);
  }, [fleetQuery.data?.devices, selectedSiteId]);

  const onlineDevices = filteredDevices.filter((d) => !(d.last_seen?.isOffline ?? false));
  const offlineDevices = filteredDevices.filter((d) => d.last_seen?.isOffline);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.lg }}>
      <Card
        title="Fleet overview"
        subtitle="SmartMonitoring-style snapshot of every connected heat pump"
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm }}>
            <label style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
              Site
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value as typeof selectedSiteId)}
              style={{
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                background: theme.colors.surface,
                color: theme.colors.textPrimary,
              }}
            >
              <option value="all">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: theme.spacing.md }}>
          <div
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.borderSubtle}`,
              backgroundColor: theme.colors.surface,
              display: "flex",
              flexDirection: "column",
              gap: theme.spacing.xs,
            }}
          >
            <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>Devices</span>
            <strong style={{ fontSize: theme.typography.title2.fontSize, fontWeight: theme.typography.title2.fontWeight }}>
              {filteredDevices.length}
            </strong>
          </div>
          <div
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.borderSubtle}`,
              backgroundColor: theme.colors.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: theme.spacing.sm,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
              <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>Healthy</span>
              <strong style={{ fontSize: theme.typography.title2.fontSize }}>{onlineDevices.length}</strong>
            </div>
            <StatusPill status="healthy" subdued />
          </div>
          <div
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.borderSubtle}`,
              backgroundColor: theme.colors.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: theme.spacing.sm,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
              <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>Offline</span>
              <strong style={{ fontSize: theme.typography.title2.fontSize }}>{offlineDevices.length}</strong>
            </div>
            <StatusPill status="offline" subdued />
          </div>
        </div>
      </Card>

      {fleetQuery.isLoading ? (
        <ListSkeleton />
      ) : fleetQuery.isError ? (
        <Card title="Could not load fleet">
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>
            Please refresh or check your connection. The fleet endpoint is unavailable.
          </p>
        </Card>
      ) : filteredDevices.length === 0 ? (
        <Card title="No devices found">
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>
            Try selecting a different site or confirm your organisation has connected devices.
          </p>
        </Card>
      ) : (
        <div
          style={{
            display: "grid",
            gap: theme.spacing.lg,
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          }}
        >
          <Section title="Online" count={onlineDevices.length} status="healthy">
            <DeviceGrid devices={onlineDevices} />
          </Section>
          <Section title="Offline" count={offlineDevices.length} status="offline">
            <DeviceGrid devices={offlineDevices} />
          </Section>
        </div>
      )}
    </div>
  );
}

function DeviceGrid({ devices }: { devices: ApiDevice[] }) {
  const { theme } = useTheme();
  if (devices.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>No devices in this section.</p>
      </Card>
    );
  }
  return (
    <div
      style={{
        display: "grid",
        gap: theme.spacing.md,
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
      }}
    >
      {devices.map((device) => (
        <FleetDeviceCard key={device.id} device={device} />
      ))}
    </div>
  );
}

function Section({ title, count, status, children }: { title: string; count: number; status: StatusKind; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
      <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <Badge tone="neutral">{count}</Badge>
        <StatusPill status={status} subdued />
      </div>
      {children}
    </div>
  );
}
