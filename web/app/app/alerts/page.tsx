"use client";

import { Card } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

export default function AlertsPage() {
  const { theme } = useTheme();
  return (
    <Card title="Alerts">
      <p style={{ margin: 0, color: theme.colors.textSecondary }}>
        Alert list and filtering will appear here. This stub confirms navigation wiring.
      </p>
    </Card>
  );
}
