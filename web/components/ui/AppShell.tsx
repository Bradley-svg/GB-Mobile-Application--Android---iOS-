"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { useTheme } from "@/theme/ThemeProvider";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
  icon?: ReactNode;
};

type AppShellProps = {
  navItems?: NavItem[];
  topLeftSlot?: ReactNode;
  topRightSlot?: ReactNode;
  pageTitle?: string;
  children: ReactNode;
};

export function AppShell({
  navItems = [],
  topLeftSlot,
  topRightSlot,
  pageTitle = "Dashboard",
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
          position: "sticky",
          top: 0,
          alignSelf: "flex-start",
          height: "100vh",
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
            <Link
              key={item.label}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: theme.spacing.sm,
                padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
                backgroundColor: item.active ? theme.colors.brandSoft : "transparent",
                border: `1px solid ${item.active ? theme.colors.borderStrong : "transparent"}`,
                color: theme.colors.textPrimary,
                borderRadius: theme.radius.md,
                textDecoration: "none",
                fontWeight: item.active ? 600 : 500,
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
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
            gap: theme.spacing.md,
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
            <p
              style={{
                margin: 0,
                color: theme.colors.textSecondary,
                fontSize: theme.typography.caption.fontSize,
                letterSpacing: 0.2,
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
              {pageTitle}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.md, flexWrap: "wrap" }}>
            {topLeftSlot}
            {topRightSlot}
          </div>
        </header>
        <main
          style={{
            flex: 1,
            padding: `${theme.spacing.lg}px`,
            backgroundColor: theme.colors.backgroundAlt,
            minHeight: "calc(100vh - 80px)",
          }}
        >
          {children}
        </main>
      </section>
    </div>
  );
}
