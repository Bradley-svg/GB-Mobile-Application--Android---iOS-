"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
} from "recharts";
import { Badge, Card, StatusPill, Button } from "@/components/ui";
import { fetchDevice, fetchDeviceTelemetry } from "@/lib/api/devices";
import { fetchHealthPlus } from "@/lib/api/healthPlus";
import { fetchHeatPumpHistory } from "@/lib/api/heatPumpHistory";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { useDemoStatus } from "@/lib/useDemoStatus";
import type { ApiDevice, LastSeenSummary } from "@/lib/types/fleet";
import type { HeatPumpHistoryResponse, HeatPumpMetric } from "@/lib/types/history";
import type { DeviceTelemetry, TimeRange } from "@/lib/types/telemetry";
import { useTheme } from "@/theme/ThemeProvider";
import { useOrgStore } from "@/lib/orgStore";
import type { StatusKind } from "@/components/ui/StatusPill";

type TabKey = "status" | "metrics" | "history" | "parameters";
const DEGREE = "\u00b0C";

const TELEMETRY_METRICS = {
  supply: ["supply_temp", "supply_temperature_c"],
  return: ["return_temp", "return_temperature_c"],
  tank: ["tank_temp", "tank_temp_c"],
  dhw: ["dhw_temp", "dhw_temp_c"],
  ambient: ["ambient_temp", "ambient"],
  compressor: ["compressor_current", "compressor_current_a"],
  eev: ["eev_steps", "eev"],
  mode: ["mode"],
  defrost: ["defrost"],
};

const HISTORY_METRICS: Array<{
  key: HeatPumpMetric;
  label: string;
  unit?: string;
  field: string;
  decimals?: number;
}> = [
  { key: "compressor_current", label: "Compressor current", unit: "A", field: "metric_compCurrentA", decimals: 1 },
  { key: "cop", label: "COP", field: "metric_cop", decimals: 2 },
  { key: "tank_temp", label: "Tank temp", unit: DEGREE, field: "metric_tankTempC", decimals: 1 },
  { key: "dhw_temp", label: "DHW temp", unit: DEGREE, field: "metric_dhwTempC", decimals: 1 },
  { key: "ambient_temp", label: "Ambient temp", unit: DEGREE, field: "metric_ambientTempC", decimals: 1 },
  { key: "flow_rate", label: "Flow rate", unit: "L/s", field: "metric_flowRate", decimals: 1 },
  { key: "power_kw", label: "Power", unit: "kW", field: "metric_powerKw", decimals: 1 },
];

const RANGE_TO_WINDOW_MS: Record<TimeRange, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};
const DETAIL_CACHE_TIME = 5 * 60 * 1000;
const DETAIL_STALE_TIME = 30_000;
const CHART_HEIGHT = 340;

const combineSeries = (
  telemetry: DeviceTelemetry | null | undefined,
  defs: Array<{ key: string; aliases: string[] }>,
) => {
  if (!telemetry) return [];
  const map = new Map<string, Record<string, number | null>>();
  defs.forEach((def) => {
    def.aliases.forEach((alias) => {
      const points = telemetry.metrics[alias] ?? [];
      points.forEach((p) => {
        const existing = map.get(p.ts) ?? {};
        existing[def.key] = p.value ?? null;
        map.set(p.ts, existing);
      });
    });
  });
  return Array.from(map.entries())
    .map(([ts, values]) => ({ timestamp: new Date(ts).getTime(), ...values }))
    .sort((a, b) => a.timestamp - b.timestamp);
};

const latestMetric = (telemetry?: DeviceTelemetry | null, keys: string[] = []) => {
  if (!telemetry) return null;
  for (const key of keys) {
    const points = telemetry.metrics[key] ?? [];
    if (points.length > 0) {
      const value = points[points.length - 1]?.value;
      if (value !== undefined && value !== null) return value;
    }
  }
  return null;
};

const formatLastSeen = (lastSeen?: LastSeenSummary | null, iso?: string | null) => {
  if (lastSeen?.ageMinutes !== null && lastSeen?.ageMinutes !== undefined) {
    const min = lastSeen.ageMinutes;
    if (min < 1) return "just now";
    if (min < 60) return `${Math.round(min)} minute${Math.round(min) === 1 ? "" : "s"} ago`;
    const hours = Math.round(min / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return formatRelativeTime(iso, "Unknown");
};

const formatValue = (value: unknown, unit?: string, decimals?: number) => {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "number") {
    const places = decimals ?? (Math.abs(value) >= 10 ? 1 : 2);
    return `${value.toFixed(places)}${unit ?? ""}`;
  }
  return `${value}${unit ?? ""}`;
};

const deriveStatus = (device: ApiDevice | undefined, isOffline: boolean): StatusKind => {
  if (isOffline) return "offline";
  if (device?.health === "critical") return "critical";
  if (device?.health === "warning") return "warning";
  if (device?.health === "healthy") return "healthy";
  if ((device?.status || "").toLowerCase().includes("unconfig")) return "unconfigured";
  return "info";
};

type PillOption<T extends string> = { value: T; label: string };

function PillGroup<T extends string>({ value, options, onChange }: { value: T; options: Array<PillOption<T>>; onChange: (value: T) => void }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", gap: theme.spacing.xs, flexWrap: "wrap" }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            style={{
              padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
              borderRadius: theme.radius.pill,
              border: `1px solid ${active ? theme.colors.primaryMuted : theme.colors.borderSubtle}`,
              backgroundColor: active ? theme.colors.brandSoft : theme.colors.surface,
              color: active ? theme.colors.primaryMuted : theme.colors.textPrimary,
              fontWeight: theme.typography.label.fontWeight,
              cursor: "pointer",
              boxShadow: active ? `0 8px 18px ${theme.colors.shadow}` : "none",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function MetricGrid({
  rows,
}: {
  rows: { label: string; value: string | number | null | undefined; unit?: string; decimals?: number }[];
}) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: theme.spacing.sm,
      }}
    >
      {rows.map((row) => (
        <div
          key={row.label}
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
          <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>{row.label}</span>
          <strong style={{ fontSize: theme.typography.subtitle.fontSize, fontWeight: theme.typography.subtitle.fontWeight }}>
            {formatValue(row.value, row.unit, row.decimals)}
          </strong>
        </div>
      ))}
    </div>
  );
}

export default function DeviceDetailPage() {
  const params = useParams<{ deviceId: string }>();
  const deviceId = params?.deviceId;
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const currentOrgId = useOrgStore((s) => s.currentOrgId);
  const [tab, setTab] = useState<TabKey>("status");
  const initialRange = useMemo<TimeRange>(() => {
    const value = searchParams?.get("range");
    const allowed: TimeRange[] = ["1h", "6h", "24h", "7d"];
    if (value && allowed.includes(value as TimeRange)) {
      return value as TimeRange;
    }
    return "6h";
  }, [searchParams]);
  const [telemetryRange, setTelemetryRange] = useState<TimeRange>(initialRange);
  const [historyRange, setHistoryRange] = useState<TimeRange>(initialRange);
  const [historyMetric, setHistoryMetric] = useState<HeatPumpMetric>("compressor_current");
  const demoStatus = useDemoStatus();
  const isDemoOrg = demoStatus.data?.isDemoOrg ?? false;

  const deviceQuery = useQuery({
    queryKey: ["device", deviceId, currentOrgId],
    enabled: !!deviceId,
    queryFn: () => fetchDevice(deviceId as string, currentOrgId),
    staleTime: DETAIL_STALE_TIME,
    gcTime: DETAIL_CACHE_TIME,
  });

  const telemetryQuery = useQuery({
    queryKey: ["device-telemetry", deviceId, telemetryRange, currentOrgId],
    enabled: !!deviceId,
    queryFn: () => fetchDeviceTelemetry(deviceId as string, telemetryRange, currentOrgId),
    staleTime: DETAIL_STALE_TIME,
    gcTime: DETAIL_CACHE_TIME,
  });

  const historyDefinition = HISTORY_METRICS.find((m) => m.key === historyMetric) ?? HISTORY_METRICS[0];
  const now = Date.now();
  const historyFrom = new Date(now - RANGE_TO_WINDOW_MS[historyRange]).toISOString();
  const historyTo = new Date(now).toISOString();
  const historyQuery = useQuery<HeatPumpHistoryResponse>({
    queryKey: ["heat-pump-history", deviceId, historyMetric, historyRange, currentOrgId],
    enabled: !!deviceId,
    queryFn: () =>
      fetchHeatPumpHistory({
        deviceId: deviceId as string,
        from: historyFrom,
        to: historyTo,
        fields: [{ field: historyDefinition.field }],
        orgId: currentOrgId ?? undefined,
      }),
    staleTime: DETAIL_STALE_TIME,
    gcTime: DETAIL_CACHE_TIME,
    refetchOnWindowFocus: false,
  });

  const healthPlusQuery = useQuery({
    queryKey: ["health-plus"],
    queryFn: fetchHealthPlus,
    staleTime: 5 * 60 * 1000,
    gcTime: DETAIL_CACHE_TIME,
  });

  const device: ApiDevice | undefined = deviceQuery.data;
  const telemetry = telemetryQuery.data;
  const telemetryEmpty =
    telemetry && Object.values(telemetry.metrics || {}).every((points) => (points?.length ?? 0) === 0);

  const isOffline =
    device?.health === "offline" || device?.last_seen?.isOffline || (device?.status || "").toLowerCase().includes("off");
  const statusKind = deriveStatus(device, isOffline);

  const metricRows = useMemo(
    () => [
      { label: "Tank", value: latestMetric(telemetry, TELEMETRY_METRICS.tank), unit: DEGREE },
      { label: "DHW", value: latestMetric(telemetry, TELEMETRY_METRICS.dhw), unit: DEGREE },
      { label: "Ambient", value: latestMetric(telemetry, TELEMETRY_METRICS.ambient), unit: DEGREE },
      { label: "Supply", value: latestMetric(telemetry, TELEMETRY_METRICS.supply), unit: DEGREE },
      { label: "Return", value: latestMetric(telemetry, TELEMETRY_METRICS.return), unit: DEGREE },
      { label: "Compressor", value: latestMetric(telemetry, TELEMETRY_METRICS.compressor), unit: " A" },
      { label: "EEV steps", value: latestMetric(telemetry, TELEMETRY_METRICS.eev) },
      { label: "Mode", value: latestMetric(telemetry, TELEMETRY_METRICS.mode) },
      { label: "Defrost", value: latestMetric(telemetry, TELEMETRY_METRICS.defrost) },
    ],
    [telemetry],
  );

  const heroMetrics = metricRows.filter((row) => ["Tank", "DHW", "Ambient", "Compressor", "EEV steps", "Mode", "Defrost"].includes(row.label));

  const chartData = useMemo(
    () =>
      combineSeries(telemetry, [
        { key: "tank_temp", aliases: TELEMETRY_METRICS.tank },
        { key: "dhw_temp", aliases: TELEMETRY_METRICS.dhw },
        { key: "ambient_temp", aliases: TELEMETRY_METRICS.ambient },
        { key: "supply_temp", aliases: TELEMETRY_METRICS.supply },
        { key: "return_temp", aliases: TELEMETRY_METRICS.return },
      ]),
    [telemetry],
  );

  const historyPoints = useMemo(() => {
    const series = historyQuery.data?.series?.[0];
    if (!series) return [];
    return series.points
      .map((p) => ({ timestamp: new Date(p.timestamp).getTime(), value: p.value }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [historyQuery.data]);

  const vendorCaption =
    healthPlusQuery.data?.heatPumpHistory?.configured && !healthPlusQuery.data?.heatPumpHistory?.disabled
      ? "Live vendor history via /heat-pump-history"
      : undefined;
  const chartShellStyle = {
    width: "100%",
    height: CHART_HEIGHT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (deviceQuery.isLoading) {
    return (
      <Card>
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>Loading device...</p>
      </Card>
    );
  }

  if (deviceQuery.isError || !device) {
    return (
      <Card title="Could not load device">
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>Check the device ID or try again later.</p>
      </Card>
    );
  }

  const content = (() => {
    if (tab === "status") {
      return (
        <Card title="Status snapshot" subtitle="Latest readings from the device">
          <MetricGrid rows={metricRows} />
        </Card>
      );
    }

    if (tab === "metrics") {
      return (
        <Card title="Telemetry" subtitle="Overlay of key temperatures">
          <div style={{ display: "flex", gap: theme.spacing.sm, marginBottom: theme.spacing.sm, flexWrap: "wrap" }}>
            <PillGroup<TimeRange>
              value={telemetryRange}
              options={([
                { value: "1h", label: "1h" },
                { value: "6h", label: "6h" },
                { value: "24h", label: "24h" },
                { value: "7d", label: "7d" },
              ]) as Array<PillOption<TimeRange>>}
              onChange={(range) => setTelemetryRange(range)}
            />
          </div>

          {telemetryQuery.isLoading ? (
            <div style={chartShellStyle}>
              <p style={{ color: theme.colors.textSecondary, margin: 0 }}>Loading telemetry...</p>
            </div>
          ) : telemetryQuery.isError ? (
            <div style={chartShellStyle}>
              <p style={{ color: theme.colors.error, margin: 0 }}>Could not load telemetry.</p>
            </div>
          ) : chartData.length === 0 ? (
            <div style={chartShellStyle}>
              <p style={{ color: theme.colors.textSecondary, margin: 0 }}>
                {isDemoOrg ? "Waiting for live data..." : "No telemetry data in this range."}
              </p>
            </div>
          ) : (
            <div style={{ width: "100%", height: CHART_HEIGHT }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke={theme.colors.borderSubtle} />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    tick={{ fill: theme.colors.textSecondary, fontSize: 12 }}
                    label={{ value: "Time", position: "insideBottomRight", offset: -6, fill: theme.colors.textSecondary, fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fill: theme.colors.textSecondary, fontSize: 12 }}
                    label={{
                      value: `Temperature (${DEGREE})`,
                      angle: -90,
                      position: "insideLeft",
                      fill: theme.colors.textSecondary,
                      fontSize: 12,
                    }}
                  />
                  <Tooltip
                    labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
                    contentStyle={{
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.borderSubtle,
                      color: theme.colors.textPrimary,
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 8 }} />
                  <Line type="monotone" dataKey="tank_temp" name="Tank" stroke={theme.colors.chartPrimary} dot={false} />
                  <Line type="monotone" dataKey="dhw_temp" name="DHW" stroke={theme.colors.chartSecondary} dot={false} />
                  <Line type="monotone" dataKey="ambient_temp" name="Ambient" stroke={theme.colors.chartTertiary} dot={false} />
                  <Line type="monotone" dataKey="supply_temp" name="Supply" stroke={theme.colors.chartQuaternary} dot={false} />
                  <Line type="monotone" dataKey="return_temp" name="Return" stroke={theme.colors.info} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      );
    }

    if (tab === "history") {
      return (
        <Card title="History" subtitle="Vendor history with labelled axes">
          <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap", marginBottom: theme.spacing.sm }}>
            <select
              value={historyMetric}
              onChange={(e) => setHistoryMetric(e.target.value as HeatPumpMetric)}
              style={{
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                background: theme.colors.surface,
              }}
            >
              {HISTORY_METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <PillGroup<TimeRange>
              value={historyRange}
              options={([
                { value: "1h", label: "1h" },
                { value: "6h", label: "6h" },
                { value: "24h", label: "24h" },
                { value: "7d", label: "7d" },
              ]) as Array<PillOption<TimeRange>>}
              onChange={(range) => setHistoryRange(range)}
            />
          </div>

          {historyQuery.isLoading ? (
            <div style={chartShellStyle}>
              <p style={{ color: theme.colors.textSecondary, margin: 0 }}>Loading history...</p>
            </div>
          ) : historyQuery.isError ? (
            <div style={chartShellStyle}>
              <p style={{ color: theme.colors.error, margin: 0 }}>
                {(historyQuery.error as { message?: string })?.message ?? "Could not load heat pump history."}
              </p>
            </div>
          ) : historyPoints.length === 0 ? (
            <div style={chartShellStyle}>
              <p style={{ color: theme.colors.textSecondary, margin: 0 }}>
                {isDemoOrg ? "Waiting for live data... Try the last 6h range." : "No history points for this metric."}
              </p>
            </div>
          ) : (
            <div style={{ width: "100%", height: CHART_HEIGHT }}>
              <ResponsiveContainer>
                <LineChart data={historyPoints} margin={{ top: 8, right: 16, left: 0, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke={theme.colors.borderSubtle} />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    tick={{ fill: theme.colors.textSecondary, fontSize: 12 }}
                    label={{ value: "Time", position: "insideBottomRight", offset: -6, fill: theme.colors.textSecondary, fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fill: theme.colors.textSecondary, fontSize: 12 }}
                    label={{
                      value: historyDefinition.unit ? `${historyDefinition.label} (${historyDefinition.unit})` : historyDefinition.label,
                      angle: -90,
                      position: "insideLeft",
                      fill: theme.colors.textSecondary,
                      fontSize: 12,
                    }}
                  />
                  <Tooltip
                    labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
                    formatter={(value: number | null) => [
                      value == null ? "N/A" : value.toFixed(historyDefinition.decimals ?? 1),
                      historyDefinition.label,
                    ]}
                    contentStyle={{
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.borderSubtle,
                      color: theme.colors.textPrimary,
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 8 }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={`${historyDefinition.label}${historyDefinition.unit ? ` (${historyDefinition.unit})` : ""}`}
                    stroke={theme.colors.chartPrimary}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {vendorCaption ? (
            <p style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.sm }}>{vendorCaption}</p>
          ) : null}
        </Card>
      );
    }

    return (
      <Card title="Parameters" subtitle="Read-only parameters shown here">
        <MetricGrid
          rows={[
            { label: "Controller", value: device?.controller ?? "N/A" },
            { label: "Firmware", value: device?.firmware_version ?? "Unknown" },
            { label: "Connectivity", value: device?.connectivity_status ?? device?.status ?? "Unknown" },
            { label: "Site", value: device?.site_name ?? "Unknown" },
            { label: "Device type", value: device?.type ?? "Heat pump" },
          ]}
        />
      </Card>
    );
  })();

  return (
    <div className="device-layout">
      <div className="device-hero">
        <Card
          title={device.name}
          subtitle={device.site_name ?? "Unknown site"}
          actions={
            <Button as="a" href="/app/alerts" variant="secondary" size="sm">
              View alerts
            </Button>
          }
        >
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: theme.spacing.sm }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ color: theme.colors.textSecondary, fontFamily: "monospace" }}>{device.mac || "MAC unknown"}</span>
              <span style={{ color: theme.colors.textSecondary }}>
                Last seen: {formatLastSeen(device.last_seen, device.last_seen_at ?? undefined)}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" }}>
              <StatusPill status={statusKind} />
              <Badge tone={isOffline ? "error" : "success"}>{isOffline ? "Offline" : "Healthy"}</Badge>
            </div>
          </div>

          <div style={{ marginTop: theme.spacing.md }}>
            <MetricGrid rows={heroMetrics} />
          </div>

          <div style={{ marginTop: theme.spacing.md }}>
            <PillGroup<TabKey>
              value={tab}
              options={([
                { value: "status", label: "Status" },
                { value: "metrics", label: "Metrics" },
                { value: "history", label: "History" },
                { value: "parameters", label: "Parameters" },
              ]) as Array<PillOption<TabKey>>}
              onChange={(next) => setTab(next)}
            />
          </div>
        </Card>
      </div>

      <div className="device-content">{content}</div>

      <style>{`
        .device-layout {
          display: grid;
          gap: ${theme.spacing.lg}px;
        }
        @media (min-width: 1200px) {
          .device-layout {
            grid-template-columns: 380px 1fr;
            align-items: start;
          }
          .device-hero {
            position: sticky;
            top: ${theme.spacing.xl}px;
          }
        }
        @media (max-width: 1199px) {
          .device-layout {
            grid-template-columns: 1fr;
          }
          .device-hero,
          .device-content {
            grid-column: 1;
          }
        }
      `}</style>
    </div>
  );
}
