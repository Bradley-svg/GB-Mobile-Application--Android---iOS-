"use client";

import { Badge } from "@/components/ui";
import { useDemoStatus } from "@/lib/useDemoStatus";
import { useTheme } from "@/theme/ThemeProvider";

type DemoModeBadgeProps = {
  enabled?: boolean;
};

export function DemoModeBadge({ enabled = true }: DemoModeBadgeProps) {
  const { theme } = useTheme();
  const { data } = useDemoStatus({ enabled });

  if (!data?.isDemoOrg) return null;

  return (
    <Badge
      tone="info"
      data-testid="demo-mode-pill"
      style={{
        backgroundColor: theme.colors.surfaceAlt,
        boxShadow: `0 10px 24px ${theme.colors.shadow}`,
      }}
    >
      Demo mode
    </Badge>
  );
}
