"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import type { ApiDevice, LastSeenSummary } from "@/lib/types/fleet";
import type { HeatPumpHistoryResponse, HeatPumpMetric } from "@/lib/types/history";
import type { DeviceTelemetry, TimeRange } from "@/lib/types/telemetry";
import { useTheme } from "@/theme/ThemeProvider";
import { useOrgStore } from "@/lib/orgStore";

type TabKey = "status" | "metrics" | "history" | "parameters";

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
  { key: "tank_temp", label: "Tank temp", unit: "°C", field: "metric_tankTempC", decimals: 1 },
  { key: "dhw_temp", label: "DHW temp", unit: "°C", field: "metric_dhwTempC", decimals: 1 },
  { key: "ambient_temp", label: "Ambient temp", unit: "°C", field: "metric_ambientTempC", decimals: 1 },
  { key: "flow_rate", label: "Flow rate", unit: "L/s", field: "metric_flowRate", decimals: 1 },
  { key: "power_kw", label: "Power", unit: "kW", field: "metric_powerKw", decimals: 1 },
];

const RANGE_TO_WINDOW_MS: Record<TimeRange, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

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

const formatValue = (value: unknown, unit?: string) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    const rounded = Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
    return `${rounded}${unit ?? ""}`;
  }
  return `${value}${unit ?? ""}`;
};

function MetricGrid({
  rows,
}: {
  rows: { label: string; value: string | number | null | undefined; unit?: string }[];
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
          }}
        >
          <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
            {row.label}
          </span>
          <strong style={{ fontSize: theme.typography.subtitle.fontSize, fontWeight: theme.typography.subtitle.fontWeight }}>
            {formatValue(row.value, row.unit)}
          </strong>
        </div>
      ))}
    </div>
  );
}

export default function DeviceDetailPage() {
  const params = useParams<{ deviceId: string }>();
  const deviceId = params?.deviceId;
  const { theme } = useTheme();
  const currentOrgId = useOrgStore((s) => s.currentOrgId);
  const [tab, setTab] = useState<TabKey>("status");
  const [telemetryRange, setTelemetryRange] = useState<TimeRange>("6h");
  const [historyRange, setHistoryRange] = useState<TimeRange>("6h");
  const [historyMetric, setHistoryMetric] = useState<HeatPumpMetric>("compressor_current");

  const deviceQuery = useQuery({
    queryKey: ["device", deviceId, currentOrgId],
    enabled: !!deviceId,
    queryFn: () => fetchDevice(deviceId as string, currentOrgId),
  });

  const telemetryQuery = useQuery({
    queryKey: ["device-telemetry", deviceId, telemetryRange, currentOrgId],
    enabled: !!deviceId,
    queryFn: () => fetchDeviceTelemetry(deviceId as string, telemetryRange, currentOrgId),
    staleTime: 60_000,
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
    staleTime: 60_000,
  });

  const healthPlusQuery = useQuery({
    queryKey: ["health-plus"],
    queryFn: fetchHealthPlus,
    staleTime: 5 * 60 * 1000,
  });

  const device: ApiDevice | undefined = deviceQuery.data;
  const telemetry = telemetryQuery.data;

  const isOffline =
    device?.health === "offline" || device?.last_seen?.isOffline || (device?.status || "").toLowerCase().includes("off");

  const metricRows = useMemo(
    () => [
      { label: "Tank °C", value: latestMetric(telemetry, TELEMETRY_METRICS.tank), unit: "°C" },
      { label: "DHW °C", value: latestMetric(telemetry, TELEMETRY_METRICS.dhw), unit: "°C" },
      { label: "Ambient °C", value: latestMetric(telemetry, TELEMETRY_METRICS.ambient), unit: "°C" },
      { label: "Supply °C", value: latestMetric(telemetry, TELEMETRY_METRICS.supply), unit: "°C" },
      { label: "Return °C", value: latestMetric(telemetry, TELEMETRY_METRICS.return), unit: "°C" },
      { label: "Compressor A", value: latestMetric(telemetry, TELEMETRY_METRICS.compressor) },
      { label: "EEV steps", value: latestMetric(telemetry, TELEMETRY_METRICS.eev) },
      { label: "Mode", value: latestMetric(telemetry, TELEMETRY_METRICS.mode) },
      { label: "Defrost", value: latestMetric(telemetry, TELEMETRY_METRICS.defrost) },
    ],
    [telemetry],
  );

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

  const content = (() => {
    if (tab === "status") {
      return (
        <Card title="Status">
          <MetricGrid rows={metricRows} />
        </Card>
      );
    }

    if (tab === "metrics") {
      return (
        <Card title="Metrics">
          <div style={{ display: "flex", gap: theme.spacing.sm, marginBottom: theme.spacing.sm, flexWrap: "wrap" }}>
            {(["1h", "6h", "24h", "7d"] as TimeRange[]).map((range) => (
              <Button
                key={range}
                variant={telemetryRange === range ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTelemetryRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>

          {telemetryQuery.isLoading ? (
            <p style={{ color: theme.colors.textSecondary }}>Loading telemetry...</p>
          ) : telemetryQuery.isError ? (
            <p style={{ color: theme.colors.error }}>Could not load telemetry.</p>
          ) : chartData.length === 0 ? (
            <p style={{ color: theme.colors.textSecondary }}>No telemetry data in this range.</p>
          ) : (
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="4 4" stroke={theme.colors.borderSubtle} />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    tick={{ fill: theme.colors.textSecondary, fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: theme.colors.textSecondary, fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
                    contentStyle={{
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.borderSubtle,
                      color: theme.colors.textPrimary,
                    }}
                  />
                  <Legend />
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
        <Card title="History">
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
            {(["1h", "6h", "24h", "7d"] as TimeRange[]).map((range) => (
              <Button key={range} size="sm" variant={historyRange === range ? "primary" : "secondary"} onClick={() => setHistoryRange(range)}>
                {range}
              </Button>
            ))}
          </div>

          {historyQuery.isLoading ? (
            <p style={{ color: theme.colors.textSecondary }}>Loading history...</p>
          ) : historyQuery.isError ? (
            <p style={{ color: theme.colors.error }}>
              {(historyQuery.error as { message?: string })?.message ?? "Could not load heat pump history."}
            </p>
          ) : historyPoints.length === 0 ? (
            <p style={{ color: theme.colors.textSecondary }}>No history points for this metric.</p>
          ) : (
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={historyPoints}>
                  <CartesianGrid strokeDasharray="4 4" stroke={theme.colors.borderSubtle} />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    tick={{ fill: theme.colors.textSecondary, fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: theme.colors.textSecondary, fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
                    formatter={(value: number | null) => [
                      value == null ? "—" : value.toFixed(historyDefinition.decimals ?? 1),
                      historyDefinition.label,
                    ]}
                    contentStyle={{
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.borderSubtle,
                      color: theme.colors.textPrimary,
                    }}
                  />
                  <Legend />
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
      <Card title="Parameters">
        <p style={{ marginTop: 0, color: theme.colors.textSecondary }}>
          Read-only parameters shown here. Editing will be added later.
        </p>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: theme.spacing.sm }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 style={{ margin: 0 }}>{device.name}</h2>
            <span style={{ color: theme.colors.textSecondary, fontFamily: "monospace" }}>{device.mac || "MAC unknown"}</span>
            <span style={{ color: theme.colors.textSecondary }}>{device.site_name || "Unknown site"}</span>
            <span style={{ color: theme.colors.textSecondary }}>
              Last seen: {formatLastSeen(device.last_seen, device.last_seen_at ?? undefined)}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm }}>
            <StatusPill status={isOffline ? "offline" : "online"} />
            <Badge tone={isOffline ? "error" : "success"}>{isOffline ? "Offline" : "Online"}</Badge>
            <Link href="/app/alerts" style={{ color: theme.colors.primary }}>
              View alerts
            </Link>
          </div>
        </div>

        <div style={{ marginTop: theme.spacing.md, display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
          {(["status", "metrics", "history", "parameters"] as TabKey[]).map((key) => (
            <Button key={key} size="sm" variant={tab === key ? "primary" : "secondary"} onClick={() => setTab(key)}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </Button>
          ))}
        </div>
      </Card>

      {content}
    </div>
  );
}
