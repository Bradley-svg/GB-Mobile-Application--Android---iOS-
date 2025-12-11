"use client";

import type { HTMLAttributes } from "react";
import { useTheme } from "@/theme/ThemeProvider";

type BaseStatus = "healthy" | "offline" | "unconfigured" | "critical" | "warning" | "info" | "unknown";
type StatusAlias = "online" | "degraded";
export type StatusKind = BaseStatus | StatusAlias;

type StatusVariant = {
  label: string;
  fg: string;
  bg: string;
  border: string;
};

export function resolveStatusVariant(status: StatusKind, themeColors: ReturnType<typeof useTheme>["theme"]["colors"]): StatusVariant {
  const normalized: BaseStatus =
    status === "online"
      ? "healthy"
      : status === "degraded"
        ? "warning"
        : (status as BaseStatus);

  const palette: Record<BaseStatus, StatusVariant> = {
    healthy: { label: "Healthy", fg: themeColors.statusOnline, bg: themeColors.successSoft, border: themeColors.success },
    offline: { label: "Offline", fg: themeColors.statusOffline, bg: themeColors.errorSoft, border: themeColors.error },
    unconfigured: {
      label: "Unconfigured",
      fg: themeColors.warning,
      bg: themeColors.warningSoft,
      border: themeColors.warningBorder ?? themeColors.warning,
    },
    critical: { label: "Critical", fg: themeColors.error, bg: themeColors.errorSoft, border: themeColors.errorBorder ?? themeColors.error },
    warning: { label: "Warning", fg: themeColors.warning, bg: themeColors.warningSoft, border: themeColors.warningBorder ?? themeColors.warning },
    info: { label: "Info", fg: themeColors.info, bg: themeColors.infoSoft, border: themeColors.infoBorder ?? themeColors.info },
    unknown: {
      label: "Unknown",
      fg: themeColors.textSecondary,
      bg: themeColors.surfaceAlt,
      border: themeColors.borderSubtle,
    },
  };

  return palette[normalized] ?? palette.unknown;
}

type StatusPillProps = {
  status: StatusKind;
  label?: string;
  subdued?: boolean;
} & HTMLAttributes<HTMLSpanElement>;

export function StatusPill({ status, label, subdued = false, ...rest }: StatusPillProps) {
  const { theme } = useTheme();
  const palette = resolveStatusVariant(status, theme.colors);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: theme.spacing.xs,
        padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
        borderRadius: theme.radius.pill,
        backgroundColor: subdued ? palette.bg : palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        fontSize: theme.typography.caption.fontSize,
        fontWeight: theme.typography.label.fontWeight,
        boxShadow: subdued ? "none" : `0 6px 16px ${theme.colors.shadow}`,
      }}
      {...rest}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: palette.fg,
          boxShadow: `0 0 0 4px ${palette.bg}`,
        }}
      />
      {label ?? palette.label}
    </span>
  );
}
