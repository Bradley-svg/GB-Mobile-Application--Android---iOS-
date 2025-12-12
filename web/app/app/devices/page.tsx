"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import { useDemoStatus } from "@/lib/useDemoStatus";
import { useTheme } from "@/theme/ThemeProvider";

export default function DevicesIndexPage() {
  const { theme } = useTheme();
  const { data: demoStatus } = useDemoStatus();
  const isDemoOrg = demoStatus?.isDemoOrg ?? false;
  const heroDeviceId = demoStatus?.heroDeviceId;
  const heroHref = isDemoOrg && heroDeviceId ? `/app/devices/${heroDeviceId}` : null;
  const heroLabel = demoStatus?.heroDeviceMac || heroDeviceId || "demo hero";

  return (
    <Card title="Sites and devices">
      <p style={{ marginTop: 0, color: theme.colors.textSecondary }}>
        Device directory coming soon.
        {isDemoOrg ? " Use the demo hero device below while we fill in the directory." : ""}
      </p>
      {heroHref ? (
        <Link href={heroHref} style={{ color: theme.colors.primary }} data-testid="demo-hero-device-link">
          View demo hero device ({heroLabel})
        </Link>
      ) : null}
    </Card>
  );
}
