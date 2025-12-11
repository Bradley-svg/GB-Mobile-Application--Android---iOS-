"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card } from "@/components/ui";
import { listMaintenanceSummary } from "@/lib/api/maintenance";
import { fetchFleet } from "@/lib/api/fleet";
import { useOrgStore } from "@/lib/orgStore";
import type { MaintenanceSummary, MaintenanceSummaryItem } from "@/lib/types/maintenance";
import { useTheme } from "@/theme/ThemeProvider";

type WindowOption = 30 | 60;

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const filterByDateWindow = (summary: MaintenanceSummary | undefined, days: number) => {
  if (!summary) return { byDate: [], openCount: 0, overdueCount: 0, dueSoonCount: 0 };
  const now = startOfDay(new Date());
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const soonCutoff = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const byDate = (summary.byDate ?? []).filter((bucket) => {
    const bucketDate = startOfDay(new Date(bucket.date));
    return bucketDate.getTime() >= now.getTime() && bucketDate.getTime() <= end.getTime();
  });

  const totals = byDate.reduce(
    (acc, day) => {
      acc.openCount += day.open.length;
      acc.overdueCount += day.overdue.length;
      acc.dueSoonCount += day.open.filter((item) => {
        const due = startOfDay(new Date(item.slaDueAt));
        return due.getTime() <= soonCutoff.getTime();
      }).length;
      return acc;
    },
    { openCount: 0, overdueCount: 0, dueSoonCount: 0 },
  );

  return { ...totals, byDate };
};

const itemStatusLabel = (item: MaintenanceSummaryItem) => {
  const due = new Date(item.slaDueAt);
  const now = new Date();
  const today = startOfDay(now).getTime();
  const dueDay = startOfDay(due).getTime();

  if (item.status === "done") return "Done";
  if (due.getTime() < now.getTime()) return "Overdue";
  if (dueDay === today) return "Due today";
  const diffDays = Math.round((dueDay - today) / (24 * 60 * 60 * 1000));
  return diffDays === 1 ? "Due tomorrow" : `Due in ${diffDays} days`;
};

export default function MaintenancePage() {
  const { theme } = useTheme();
  const currentOrgId = useOrgStore((s) => s.currentOrgId);
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [windowDays, setWindowDays] = useState<WindowOption>(30);

  const summaryQuery = useQuery({
    queryKey: ["maintenance-summary", siteFilter, deviceFilter, currentOrgId],
    queryFn: () =>
      listMaintenanceSummary({
        orgId: currentOrgId ?? undefined,
        siteId: siteFilter === "all" ? undefined : siteFilter,
        deviceId: deviceFilter === "all" ? undefined : deviceFilter,
      }),
  });

  const fleetQuery = useQuery({
    queryKey: ["fleet", currentOrgId],
    queryFn: () => fetchFleet({ orgId: currentOrgId ?? undefined }),
  });

  const filteredSummary = useMemo(() => filterByDateWindow(summaryQuery.data, windowDays), [summaryQuery.data, windowDays]);
  const hasData = (filteredSummary.byDate ?? []).length > 0;
  const emptyLabel = "All clear – no upcoming maintenance.";

  const sites = fleetQuery.data?.sites ?? [];
  const devices = useMemo(() => {
    const allDevices = fleetQuery.data?.devices ?? [];
    if (siteFilter === "all") return allDevices;
    return allDevices.filter((d) => d.site_id === siteFilter);
  }, [fleetQuery.data?.devices, siteFilter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: theme.spacing.md, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, color: theme.colors.textSecondary }}>Maintenance</p>
            <h2 style={{ margin: 0 }}>Calendar & reminders</h2>
            <p style={{ margin: 0, color: theme.colors.textSecondary }}>
              Upcoming preventive maintenance pulled from the same endpoints as mobile.
            </p>
          </div>
          <div style={{ display: "flex", gap: theme.spacing.sm, alignItems: "center" }}>
            {[30, 60].map((value) => (
              <Button
                key={value}
                size="sm"
                variant={windowDays === value ? "primary" : "secondary"}
                onClick={() => setWindowDays(value as WindowOption)}
              >
                Next {value} days
              </Button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap", marginTop: theme.spacing.md }}>
          <label style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
            Site
            <select
              value={siteFilter}
              onChange={(evt) => setSiteFilter(evt.target.value)}
              style={{
                marginLeft: theme.spacing.xs,
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                background: theme.colors.surfaceAlt,
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
          </label>
          <label style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
            Device
            <select
              value={deviceFilter}
              onChange={(evt) => setDeviceFilter(evt.target.value)}
              style={{
                marginLeft: theme.spacing.xs,
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                background: theme.colors.surfaceAlt,
                color: theme.colors.textPrimary,
              }}
            >
              <option value="all">All devices</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card>
        {summaryQuery.isLoading ? (
          <div style={{ color: theme.colors.textSecondary }}>Loading maintenance...</div>
        ) : summaryQuery.isError ? (
          <div style={{ color: theme.colors.error }}>Could not load maintenance summary.</div>
        ) : !hasData ? (
          <div data-testid="maintenance-empty" style={{ color: theme.colors.textSecondary }}>
            {emptyLabel}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
            <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
              <Badge tone="brand">Open {filteredSummary.openCount}</Badge>
              <Badge tone="warning">Overdue {filteredSummary.overdueCount}</Badge>
              <Badge tone="info">Due soon {filteredSummary.dueSoonCount}</Badge>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
              {filteredSummary.byDate.map((day) => (
                <div
                  key={day.date}
                  style={{
                    padding: `${theme.spacing.sm}px`,
                    borderRadius: theme.radius.md,
                    border: `1px solid ${theme.colors.borderSubtle}`,
                    background: theme.colors.surfaceAlt,
                  }}
                  data-testid="maintenance-day"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{new Date(day.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</strong>
                    <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
                      {day.overdue.length + day.open.length + day.done.length} items
                    </span>
                  </div>
                  {[...day.overdue, ...day.open, ...day.done].map((item) => {
                    const tone = item.status === "done" ? "success" : day.overdue.includes(item) ? "error" : "brand";
                    return (
                      <div
                        key={item.workOrderId}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 140px",
                          gap: theme.spacing.sm,
                          alignItems: "center",
                          padding: `${theme.spacing.xs}px 0`,
                        }}
                        data-testid="maintenance-item"
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <strong>{item.title}</strong>
                          <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
                            {item.siteName || "Unknown site"}
                            {item.deviceName ? ` > ${item.deviceName}` : ""}
                          </span>
                        </div>
                        <Badge tone={tone as "success" | "error" | "brand"}>{itemStatusLabel(item)}</Badge>
                        <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
                          SLA {new Date(item.slaDueAt).toLocaleDateString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
