"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/theme/ThemeProvider";

type CardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

export function Card({ title, subtitle, children }: CardProps) {
  const { theme } = useTheme();

  return (
    <div
      style={{
        backgroundColor: theme.colors.card,
        border: `1px solid ${theme.colors.borderSubtle}`,
        borderRadius: theme.radius.lg,
        boxShadow: `0 8px 24px ${theme.colors.shadow}`,
        padding: theme.spacing.lg,
      }}
    >
      {(title || subtitle) && (
        <div style={{ marginBottom: theme.spacing.md }}>
          {title && (
            <h2
              style={{
                margin: 0,
                fontSize: theme.typography.subtitle.fontSize,
                fontWeight: theme.typography.subtitle.fontWeight,
              }}
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p
              style={{
                margin: 0,
                color: theme.colors.textSecondary,
                fontSize: theme.typography.body.fontSize,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
