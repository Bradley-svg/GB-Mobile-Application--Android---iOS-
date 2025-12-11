"use client";

import { ReactNode } from "react";
import { useTheme } from "@/theme/ThemeProvider";

type NavItem = {
  label: string;
  active?: boolean;
  icon?: ReactNode;
};

type AppShellProps = {
  title?: string;
  navItems?: NavItem[];
  topActions?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  title = "Dashboard",
  navItems = [],
  topActions,
  children,
}: AppShellProps) {
  const { theme } = useTheme();

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: theme.colors.background,
        color: theme.colors.textPrimary,
      }}
    >
      <aside
        style={{
          width: 240,
          backgroundColor: theme.colors.surface,
          borderRight: `1px solid ${theme.colors.borderSubtle}`,
          padding: theme.spacing.lg,
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing.md,
        }}
      >
        <div
          style={{
            fontSize: theme.typography.title2.fontSize,
            fontWeight: theme.typography.title2.fontWeight,
            color: theme.colors.brandGreen,
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.sm,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: theme.radius.md,
              background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryMuted})`,
            }}
          />
          Greenbro
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              style={{
                display: "flex",
                alignItems: "center",
                gap: theme.spacing.sm,
                padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
                backgroundColor: item.active ? theme.colors.brandSoft : "transparent",
                border: `1px solid ${item.active ? theme.colors.borderStrong : "transparent"}`,
                color: theme.colors.textPrimary,
                borderRadius: theme.radius.md,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {item.icon}
              <span style={{ fontWeight: item.active ? 600 : 500 }}>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
            backgroundColor: theme.colors.surfaceAlt,
            borderBottom: `1px solid ${theme.colors.borderSubtle}`,
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                color: theme.colors.textSecondary,
                fontSize: theme.typography.caption.fontSize,
              }}
            >
              Greenbro
            </p>
            <h1
              style={{
                margin: 0,
                fontSize: theme.typography.title2.fontSize,
                fontWeight: theme.typography.title2.fontWeight,
              }}
            >
              {title}
            </h1>
          </div>
          {topActions}
        </header>
        <main
          style={{
            flex: 1,
            padding: `${theme.spacing.lg}px`,
            backgroundColor: theme.colors.backgroundAlt,
          }}
        >
          {children}
        </main>
      </section>
    </div>
  );
}
