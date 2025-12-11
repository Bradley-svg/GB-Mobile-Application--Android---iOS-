"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/theme/ThemeProvider";

type BadgeTone = "brand" | "neutral" | "success" | "warning" | "error" | "info";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  const { theme } = useTheme();

  const palette = {
    brand: { fg: theme.colors.primaryMuted, bg: theme.colors.brandSoft, border: theme.colors.borderSubtle },
    neutral: { fg: theme.colors.textSecondary, bg: theme.colors.surfaceAlt, border: theme.colors.borderSubtle },
    success: { fg: theme.colors.success, bg: theme.colors.successSoft, border: theme.colors.success },
    warning: { fg: theme.colors.warning, bg: theme.colors.warningSoft, border: theme.colors.warning },
    error: { fg: theme.colors.error, bg: theme.colors.errorSoft, border: theme.colors.error },
    info: { fg: theme.colors.info, bg: theme.colors.infoSoft, border: theme.colors.info },
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: theme.spacing.xs,
        padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
        borderRadius: theme.radius.pill,
        backgroundColor: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        fontSize: theme.typography.caption.fontSize,
        fontWeight: theme.typography.label.fontWeight,
      }}
    >
      {children}
    </span>
  );
}
