"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card, StatusPill } from "@/components/ui";
import { fetchDeviceTelemetry } from "@/lib/api/devices";
import { fetchFleet } from "@/lib/api/fleet";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { ApiDevice, FleetSearchResult, LastSeenSummary } from "@/lib/types/fleet";
import type { DeviceTelemetry } from "@/lib/types/telemetry";
import { useTheme } from "@/theme/ThemeProvider";

type MetricValue = string | number | null | undefined;

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

type FleetDeviceCardProps = {
  device: ApiDevice;
};

function FleetDeviceCard({ device }: FleetDeviceCardProps) {
  const { theme } = useTheme();
  const status = (device.status || "").toLowerCase();
  const isOffline = device.health === "offline" || device.last_seen?.isOffline || status.includes("off");

  const telemetryQuery = useQuery({
    queryKey: ["device-telemetry", device.id],
    queryFn: () => fetchDeviceTelemetry(device.id, "1h"),
    staleTime: 60_000,
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
        padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.colors.borderSubtle}`,
        backgroundColor: theme.colors.surface,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>{label}</span>
      <strong style={{ fontSize: theme.typography.subtitle.fontSize, fontWeight: theme.typography.subtitle.fontWeight }}>
        {value === null || value === undefined || value === "" ? "—" : `${value}${suffix}`}
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
          padding: theme.spacing.lg,
          boxShadow: `0 8px 24px ${theme.colors.shadow}`,
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing.md,
          minHeight: 240,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: theme.spacing.sm, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: theme.typography.subtitle.fontWeight }}>{device.name}</span>
            <span style={{ color: theme.colors.textSecondary, fontFamily: "monospace" }}>
              {device.mac || "MAC unknown"}
            </span>
            <span style={{ color: theme.colors.textSecondary }}>{device.site_name || "Unknown site"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm }}>
            <StatusPill status={isOffline ? "offline" : "online"} />
            <Badge tone="neutral">{formatLastSeen(device.last_seen, device.last_seen_at ?? undefined)}</Badge>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: theme.spacing.sm,
          }}
        >
          {renderMetric("Tank °C", metrics.tank, typeof metrics.tank === "number" ? "°" : "")}
          {renderMetric("DHW °C", metrics.dhw, typeof metrics.dhw === "number" ? "°" : "")}
          {renderMetric("Ambient °C", metrics.ambient, typeof metrics.ambient === "number" ? "°" : "")}
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
            padding: theme.spacing.lg,
            minHeight: 200,
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.sm,
            animation: "pulse 1.6s ease-in-out infinite",
            opacity: 0.8,
          }}
        >
          <div style={{ height: 12, width: "40%", background: theme.colors.backgroundAlt, borderRadius: theme.radius.sm }} />
          <div style={{ height: 10, width: "60%", background: theme.colors.backgroundAlt, borderRadius: theme.radius.sm }} />
          <div style={{ height: 120, background: theme.colors.backgroundAlt, borderRadius: theme.radius.md }} />
        </div>
      ))}
      <style>{`@keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }`}</style>
    </div>
  );
};

export default function FleetOverviewPage() {
  const { theme } = useTheme();
  const [selectedSiteId, setSelectedSiteId] = useState<string | "all">("all");

  const fleetQuery = useQuery<FleetSearchResult>({
    queryKey: ["fleet", selectedSiteId],
    queryFn: () => fetchFleet(),
    staleTime: 30_000,
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
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.md }}>
          <div>
            <h2 style={{ margin: 0, fontSize: theme.typography.subtitle.fontSize, fontWeight: theme.typography.subtitle.fontWeight }}>
              Fleet overview
            </h2>
            <p style={{ margin: 0, color: theme.colors.textSecondary }}>
              Devices grouped by status with quick metrics. Click a card to drill into details.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm }}>
            <label style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
              Site filter
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
        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.lg }}>
          <Section title="Online" count={onlineDevices.length}>
            <DeviceGrid devices={onlineDevices} />
          </Section>
          <Section title="Offline" count={offlineDevices.length}>
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

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
      <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <Badge tone={title === "Offline" ? "error" : "success"}>{count}</Badge>
      </div>
      {children}
    </div>
  );
}
