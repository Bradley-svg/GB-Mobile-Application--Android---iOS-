"use client";

import { useTheme } from "@/theme/ThemeProvider";

type StatusKind = "online" | "offline" | "degraded" | "unknown";

type StatusPillProps = {
  status: StatusKind;
  label?: string;
};

const STATUS_LABELS: Record<StatusKind, string> = {
  online: "Online",
  offline: "Offline",
  degraded: "Degraded",
  unknown: "Unknown",
};

export function StatusPill({ status, label }: StatusPillProps) {
  const { theme } = useTheme();
  const palette = {
    online: { fg: theme.colors.statusOnline, bg: theme.colors.successSoft, border: theme.colors.success },
    offline: { fg: theme.colors.statusOffline, bg: theme.colors.errorSoft, border: theme.colors.error },
    degraded: { fg: theme.colors.statusDegraded, bg: theme.colors.warningSoft, border: theme.colors.warning },
    unknown: { fg: theme.colors.statusUnknown, bg: theme.colors.infoSoft, border: theme.colors.info },
  }[status];

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
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}
