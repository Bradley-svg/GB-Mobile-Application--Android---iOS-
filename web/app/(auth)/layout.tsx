"use client";

import type { ReactNode } from "react";
import { useEmbed } from "@/lib/useEmbed";
import { useTheme } from "@/theme/ThemeProvider";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const { embedActive } = useEmbed();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: embedActive ? "flex-start" : "center",
        backgroundColor: theme.colors.backgroundAlt,
        color: theme.colors.textPrimary,
        padding: `${theme.spacing.lg}px`,
        paddingTop: embedActive ? theme.spacing.lg : theme.spacing.xl,
      }}
    >
      <div style={{ width: "100%", maxWidth: 520, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
