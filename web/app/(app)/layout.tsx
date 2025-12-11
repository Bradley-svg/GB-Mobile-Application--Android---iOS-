"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell, Badge, Button } from "@/components/ui";
import { me } from "@/lib/api/authApi";
import { useAuthStore } from "@/lib/authStore";
import { useOrgRoleAwareLoader, useOrgStore } from "@/lib/orgStore";
import { useUserRole } from "@/lib/useUserRole";
import { useEmbed } from "@/lib/useEmbed";
import { useSessionTimeout, type SessionExpireReason } from "@/lib/useSessionTimeout";
import { useTheme } from "@/theme/ThemeProvider";
import { AUTH_2FA_ENFORCE_ROLES } from "@/config/env";

const pathTitleMap: Record<string, string> = {
  "/app": "Fleet overview",
  "/app/alerts": "Alerts",
  "/app/work-orders": "Work orders",
  "/app/maintenance": "Maintenance",
  "/app/documents": "Documents",
  "/app/sharing": "Sharing",
  "/app/diagnostics": "Diagnostics",
  "/app/admin": "Admin",
  "/app/profile": "Profile",
};

const pathSubtitleMap: Record<string, string> = {
  "/app": "Devices, status, and history",
  "/app/alerts": "Live rules, muted alerts, and triage",
  "/app/work-orders": "Tasks, SLAs, and assignments",
  "/app/maintenance": "Calendar and planned downtime",
  "/app/documents": "Files, manuals, and compliance",
  "/app/sharing": "Shared access and invites",
  "/app/diagnostics": "System health and integrations",
  "/app/admin": "Org roles and security",
  "/app/profile": "Account and 2FA",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const logoutAll = useAuthStore((s) => s.logoutAll);
  const recordActivity = useAuthStore((s) => s.recordActivity);
  const twoFactorSetupRequired = useAuthStore((s) => s.twoFactorSetupRequired);
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const setUser = useAuthStore((s) => s.setUser);
  const [isReady, setIsReady] = useState(false);
  const { theme } = useTheme();
  const { isAdmin, isOwner, isFacilities } = useUserRole();
  const orgStore = useOrgStore();
  const loadOrgs = useOrgRoleAwareLoader();
  const { embedActive: embedMode, appendEmbedParam, embedFromQuery } = useEmbed();
  const clearOrgState = useCallback(() => {
    try {
      useOrgStore.persist?.clearStorage?.();
    } catch {
      // ignore
    }
    useOrgStore.setState({ currentOrgId: null, orgs: [], loading: false, error: null });
  }, []);
  const sessionExpiredReason = useSessionTimeout(
    useCallback(
      (reason) => {
        const loginPath = appendEmbedParam(`/login?expired=${reason}`);
        logoutAll({ redirectTo: loginPath, delayMs: 400, onCleared: () => clearOrgState() });
        setIsReady(false);
      },
      [appendEmbedParam, clearOrgState, logoutAll],
    ),
  );

  useEffect(() => {
    if (accessToken) {
      recordActivity();
    }
  }, [accessToken, recordActivity]);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      await loadFromStorage();
      const state = useAuthStore.getState();
      if (!state.accessToken) {
        router.replace(appendEmbedParam("/login"));
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
          router.replace(appendEmbedParam("/login"));
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
  }, [appendEmbedParam, loadFromStorage, loadOrgs, logout, router, setUser]);

  useEffect(() => {
    if (!embedMode || embedFromQuery) return;
    const currentPath =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : pathname;
    const withEmbed = appendEmbedParam(currentPath);
    if (withEmbed !== currentPath) {
      router.replace(withEmbed);
    }
  }, [appendEmbedParam, embedFromQuery, embedMode, pathname, router]);

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
      {
        label: "Diagnostics",
        href: "/app/diagnostics",
        icon: navBadge("DX"),
        hidden: !(isOwner || isAdmin || isFacilities),
      },
      { label: "Work orders", href: "/app/work-orders", icon: navBadge("WO") },
      { label: "Maintenance", href: "/app/maintenance", icon: navBadge("MT") },
      { label: "Documents", href: "/app/documents", icon: navBadge("DC") },
      { label: "Sharing", href: "/app/sharing", icon: navBadge("SH") },
      { label: "Admin", href: "/app/admin", icon: navBadge("AD"), hidden: !(isOwner || isAdmin || isFacilities) },
      { label: "Profile", href: "/app/profile", icon: navBadge("PR") },
    ];
    return items.filter((item) => !item.hidden);
  }, [isAdmin, isFacilities, isOwner, navBadge]);

  const requiresTwoFactorSetup = useMemo(() => {
    const role = user?.role?.toLowerCase() ?? "";
    const enforced = AUTH_2FA_ENFORCE_ROLES.includes(role);
    const missingSetup = enforced && !user?.two_factor_enabled;
    return Boolean(twoFactorSetupRequired || missingSetup);
  }, [twoFactorSetupRequired, user?.role, user?.two_factor_enabled]);

  const handleLogout = useCallback(() => {
    const loginPath = appendEmbedParam("/login");
    logoutAll({ redirectTo: loginPath, onCleared: () => clearOrgState() });
  }, [appendEmbedParam, clearOrgState, logoutAll]);

  const title =
    pathTitleMap[pathname] ??
    (pathname.startsWith("/app/work-orders")
      ? "Work orders"
      : pathname.startsWith("/app/maintenance")
        ? "Maintenance"
        : "Dashboard");
  const subtitle =
    pathSubtitleMap[pathname] ??
    (pathname.startsWith("/app/work-orders")
      ? pathSubtitleMap["/app/work-orders"]
      : pathname.startsWith("/app/maintenance")
        ? pathSubtitleMap["/app/maintenance"]
        : undefined);

  const sessionOverlay = sessionExpiredReason ? (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: theme.colors.card,
          color: theme.colors.textPrimary,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.xl,
          border: `1px solid ${theme.colors.borderSubtle}`,
          boxShadow: `0 24px 48px ${theme.colors.shadow}`,
          maxWidth: 420,
          width: "90%",
          display: "grid",
          gap: theme.spacing.sm,
        }}
      >
        <Badge tone="warning" style={{ justifySelf: "flex-start" }}>
          Session expired
        </Badge>
        <h2 style={{ margin: 0 }}>
          {sessionExpiredReason === "idle" ? "Signed out for inactivity" : "Session duration reached"}
        </h2>
        <p style={{ margin: 0, color: theme.colors.textSecondary }}>
          Please log in again to continue. We cleared your credentials to keep the dashboard secure.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="primary" onClick={() => router.replace(appendEmbedParam("/login"))}>
            Go to login
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  if (sessionExpiredReason) {
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
        {sessionOverlay}
      </div>
    );
  }

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
      pageSubtitle={subtitle}
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
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          )
      }
    >
      {requiresTwoFactorSetup ? (
        <div
          style={{
            marginBottom: theme.spacing.md,
            padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
            borderRadius: theme.radius.md,
            border: `1px solid ${theme.colors.warning}`,
            background: theme.colors.warningSoft,
            color: theme.colors.warning,
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.sm,
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" }}>
            <Badge tone="warning">Security</Badge>
            <span>
              Two-factor authentication is required for your role. Finish setup in Profile to avoid interrupted logins.
            </span>
          </div>
          <a
            href={appendEmbedParam("/app/profile")}
            style={{ color: theme.colors.textPrimary, textDecoration: "underline", fontWeight: 600 }}
          >
            Go to profile
          </a>
        </div>
      ) : null}
      {children}
    </AppShell>
  );
}
