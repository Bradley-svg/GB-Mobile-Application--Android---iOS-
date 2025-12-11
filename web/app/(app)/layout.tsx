"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell, Badge, Button } from "@/components/ui";
import { me } from "@/lib/api/authApi";
import { useAuthStore } from "@/lib/authStore";
import { useUserRole } from "@/lib/useUserRole";
import { useTheme } from "@/theme/ThemeProvider";

const pathTitleMap: Record<string, string> = {
  "/app": "Fleet overview",
  "/app/alerts": "Alerts",
  "/app/admin": "Admin",
  "/app/profile": "Profile",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [isReady, setIsReady] = useState(false);
  const { theme } = useTheme();
  const { isAdmin, isOwner, isFacilities } = useUserRole();

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      await loadFromStorage();
      const state = useAuthStore.getState();
      if (!state.accessToken) {
        router.replace("/login");
        return;
      }
      if (!state.user) {
        try {
          const profile = await me();
          if (active) {
            setUser(profile);
          }
        } catch {
          logout();
          router.replace("/login");
          return;
        }
      }
      if (active) {
        setIsReady(true);
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, [loadFromStorage, logout, router, setUser]);

  const navItems = useMemo(() => {
    const items = [
      { label: "Dashboard", href: "/app", icon: "📊" },
      { label: "Sites / Devices", href: "/app/devices", icon: "🛠️" },
      { label: "Alerts", href: "/app/alerts", icon: "🚨" },
      { label: "Admin", href: "/app/admin", icon: "🛡️", hidden: !(isOwner || isAdmin || isFacilities) },
      { label: "Profile", href: "/app/profile", icon: "👤" },
    ];
    return items.filter((item) => !item.hidden);
  }, [isAdmin, isFacilities, isOwner]);

  const title = pathTitleMap[pathname] ?? "Dashboard";

  if (!isReady || !accessToken || !user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.background,
          color: theme.colors.textPrimary,
        }}
      >
        Loading your workspace...
      </div>
    );
  }

  const roleLabel = user.role ?? "User";
  const initials = user.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "U";

  return (
    <AppShell
      navItems={navItems.map((item) => ({ ...item, active: pathname === item.href || pathname.startsWith(`${item.href}/`) }))}
      pageTitle={title}
      topLeftSlot={
        <div style={{ display: "flex", gap: theme.spacing.sm, alignItems: "center" }}>
          <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>Organisation</span>
          <Button variant="secondary" size="sm">
            Greenbro (placeholder)
          </Button>
        </div>
      }
      topRightSlot={
        <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm }}>
          <Badge tone="brand">{roleLabel}</Badge>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: theme.colors.brandSoft,
              color: theme.colors.brandGrey,
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
            }}
          >
            {initials}
          </div>
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            Logout
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: theme.typography.title2.fontSize,
              fontWeight: theme.typography.title2.fontWeight,
            }}
          >
            {title}
          </h1>
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>
            Quick navigation across fleet, devices, alerts, admin, and profile.
          </p>
        </div>
        {children}
      </div>
    </AppShell>
  );
}
