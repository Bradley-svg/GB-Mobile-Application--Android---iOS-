"use client";

import { Card } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  params: { deviceId: string };
};

export default function DeviceDetailPage({ params }: Props) {
  const { theme } = useTheme();
  return (
    <div style={{ display: "grid", gap: theme.spacing.lg }}>
      <Card title={`Device ${params.deviceId}`}>
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>
          Device detail view will show telemetry, controls, and history. This is a placeholder for {params.deviceId}.
        </p>
      </Card>
      <Card title="Status">
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>Online status, sensors, and last seen will be shown.</p>
      </Card>
    </div>
  );
}
