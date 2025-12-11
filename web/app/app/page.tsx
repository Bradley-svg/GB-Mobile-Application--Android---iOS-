"use client";

import { Card } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

export default function FleetOverviewPage() {
  const { theme } = useTheme();
  return (
    <div style={{ display: "grid", gap: theme.spacing.lg }}>
      <Card title="Fleet overview">
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>
          High-level fleet metrics and maps will live here. For now, this is a placeholder.
        </p>
      </Card>
      <Card title="Recent activity">
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>
          Alerts, recent commands, and site health summaries will appear in this area.
        </p>
      </Card>
    </div>
  );
}
