"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell, Badge, Button } from "@/components/ui";
import { me } from "@/lib/api/authApi";
import { useAuthStore } from "@/lib/authStore";
import { EMBED_ALLOWED } from "@/config/env";
import { useOrgRoleAwareLoader, useOrgStore } from "@/lib/orgStore";
import { useUserRole } from "@/lib/useUserRole";
import { useTheme } from "@/theme/ThemeProvider";

const pathTitleMap: Record<string, string> = {
  "/app": "Fleet overview",
  "/app/alerts": "Alerts",
  "/app/work-orders": "Work orders",
  "/app/maintenance": "Maintenance",
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
  const orgStore = useOrgStore();
  const loadOrgs = useOrgRoleAwareLoader();
  const searchParams = useSearchParams();
  const embedParam = searchParams.get("embed") === "true";
  const embedMode = EMBED_ALLOWED && embedParam;

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      await loadFromStorage();
      const state = useAuthStore.getState();
      if (!state.accessToken) {
        router.replace("/login");
        return;
      }
      let orgId = state.user?.organisation_id ?? null;
      if (!state.user) {
        try {
          const profile = await me();
          if (active) {
            setUser(profile);
          }
          orgId = profile.organisation_id ?? null;
        } catch {
          logout();
          router.replace("/login");
          return;
        }
      }
      if (active) {
        await loadOrgs(orgId);
        setIsReady(true);
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, [loadFromStorage, logout, router, setUser]);

  const navBadge = (label: string) => (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.backgroundAlt,
        border: `1px solid ${theme.colors.borderSubtle}`,
        fontSize: theme.typography.caption.fontSize,
        fontWeight: theme.typography.subtitle.fontWeight,
        color: theme.colors.textSecondary,
      }}
    >
      {label}
    </span>
  );

  const navItems = useMemo(() => {
    const items = [
      { label: "Dashboard", href: "/app", icon: navBadge("DB") },
      { label: "Sites / Devices", href: "/app/devices", icon: navBadge("DV") },
      { label: "Alerts", href: "/app/alerts", icon: navBadge("AL") },
      { label: "Work orders", href: "/app/work-orders", icon: navBadge("WO") },
      { label: "Maintenance", href: "/app/maintenance", icon: navBadge("MT") },
      { label: "Admin", href: "/app/admin", icon: navBadge("AD"), hidden: !(isOwner || isAdmin || isFacilities) },
      { label: "Profile", href: "/app/profile", icon: navBadge("PR") },
    ];
    return items.filter((item) => !item.hidden);
  }, [isAdmin, isFacilities, isOwner, navBadge]);

  const title =
    pathTitleMap[pathname] ??
    (pathname.startsWith("/app/work-orders")
      ? "Work orders"
      : pathname.startsWith("/app/maintenance")
        ? "Maintenance"
        : "Dashboard");

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
      hideChrome={embedMode}
      navItems={navItems.map((item) => ({ ...item, active: pathname === item.href || pathname.startsWith(`${item.href}/`) }))}
      pageTitle={title}
      topLeftSlot={
        embedMode
          ? null
          : isOwner || isAdmin || isFacilities
            ? (
              <div style={{ display: "flex", gap: theme.spacing.sm, alignItems: "center" }}>
                <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>Organisation</span>
                <select
                  value={orgStore.currentOrgId ?? ""}
                  onChange={(e) => orgStore.setOrg(e.target.value)}
                  style={{
                    padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                    borderRadius: theme.radius.md,
                    border: `1px solid ${theme.colors.borderSubtle}`,
                    background: theme.colors.surface,
                    color: theme.colors.textPrimary,
                  }}
                >
                  {orgStore.orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )
            : null
      }
      topRightSlot={
        embedMode
          ? null
          : (
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
          )
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
