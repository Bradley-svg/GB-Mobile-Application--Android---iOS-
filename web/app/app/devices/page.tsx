"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

export default function DevicesIndexPage() {
  const { theme } = useTheme();
  return (
    <Card title="Sites and devices">
      <p style={{ marginTop: 0, color: theme.colors.textSecondary }}>
        Device directory coming soon. Use the example link below to view a device detail stub.
      </p>
      <Link href="/app/devices/demo-device" style={{ color: theme.colors.primary }}>
        View sample device detail
      </Link>
    </Card>
  );
}
