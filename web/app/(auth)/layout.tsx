"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/theme/ThemeProvider";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.colors.backgroundAlt,
        color: theme.colors.textPrimary,
        padding: theme.spacing.lg,
      }}
    >
      {children}
    </div>
  );
}
