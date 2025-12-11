"use client";

import { AppShell, Badge, Card, StatusPill } from "@/components/ui";
import { WEB_API_BASE_URL } from "@/config/env";
import { useTheme } from "@/theme/ThemeProvider";

export default function Home() {
  const { theme } = useTheme();

  return (
    <AppShell
      title="Dashboard"
      navItems={[
        { label: "Overview", active: true },
        { label: "Work Orders" },
        { label: "Reports" },
      ]}
      topActions={<Badge tone="brand">API ready</Badge>}
    >
      <div
        style={{
          display: "grid",
          gap: theme.spacing.lg,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        <Card title="Status" subtitle="Greenbro desktop dashboard is coming soon">
          <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.sm }}>
            <StatusPill status="online" label="API reachable" />
            <p style={{ margin: 0, color: theme.colors.textSecondary, fontFamily: "monospace" }}>
              Base URL: {WEB_API_BASE_URL}
            </p>
          </div>
        </Card>

        <Card title="Next steps">
          <ul
            style={{
              margin: 0,
              paddingLeft: theme.spacing.lg,
              color: theme.colors.textSecondary,
              display: "grid",
              gap: theme.spacing.xs,
            }}
          >
            <li>Hook up auth/session store with the API.</li>
            <li>Add dashboards for work orders and heat pump history.</li>
            <li>Wire charts using shared token colors.</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
