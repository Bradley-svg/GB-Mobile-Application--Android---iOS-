"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/theme/ThemeProvider";

type CardProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  padding?: "md" | "lg";
  children: ReactNode;
};

export function Card({ title, subtitle, actions, padding = "lg", children }: CardProps) {
  const { theme } = useTheme();
  const pad = padding === "lg" ? theme.spacing.xl : theme.spacing.lg;

  return (
    <div
      style={{
        backgroundColor: theme.colors.card,
        border: `1px solid ${theme.colors.borderSubtle}`,
        borderRadius: theme.radius.lg,
        boxShadow: `0 12px 32px ${theme.colors.shadow}`,
        padding: pad,
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing.md,
      }}
    >
      {(title || subtitle || actions) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: theme.spacing.md,
            flexWrap: "wrap",
          }}
        >
          {title && (
            <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: theme.typography.subtitle.fontSize,
                  fontWeight: theme.typography.title2.fontWeight,
                  letterSpacing: 0.1,
                  color: theme.colors.textPrimary,
                }}
              >
                {title}
              </h2>
              {subtitle ? (
                <p
                  style={{
                    margin: 0,
                    color: theme.colors.textSecondary,
                    fontSize: theme.typography.body.fontSize,
                  }}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
          )}
          {actions ? <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm }}>{actions}</div> : null}
        </div>
      )}
      {children}
    </div>
  );
}
