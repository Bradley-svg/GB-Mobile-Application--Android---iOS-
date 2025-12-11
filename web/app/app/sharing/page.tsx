"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card } from "@/components/ui";
import { createShareLink, listShareLinks, revokeShareLink } from "@/lib/api/shareLinks";
import { fetchFleet } from "@/lib/api/fleet";
import { api } from "@/lib/api/httpClient";
import { WEB_API_BASE_URL } from "@/config/env";
import { useOrgStore } from "@/lib/orgStore";
import { useUserRole } from "@/lib/useUserRole";
import type { ShareLink, ShareLinkStatus } from "@/lib/types/shareLinks";
import { useTheme } from "@/theme/ThemeProvider";

type Scope = "site" | "device";

const formatDateTime = (value?: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
};

const resolveStatus = (link: ShareLink): ShareLinkStatus => {
  if (link.revokedAt) return "revoked";
  const expiresAt = new Date(link.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) return "active";
  return expiresAt.getTime() <= Date.now() ? "expired" : "active";
};

const statusTone = (status: ShareLinkStatus) =>
  ({
    active: "success" as const,
    expired: "warning" as const,
    revoked: "error" as const,
  })[status] ?? ("neutral" as const);

const shareUrlFor = (token: string) => {
  const base = api.defaults.baseURL || WEB_API_BASE_URL || "";
  const prefix = base.replace(/\/$/, "");
  return `${prefix}/public/share/${token}`;
};

export default function SharingPage() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const currentOrgId = useOrgStore((s) => s.currentOrgId);
  const { isContractor, isAdmin, isOwner, isFacilities } = useUserRole();
  const [scope, setScope] = useState<Scope>("site");
  const [siteId, setSiteId] = useState<string>("");
  const [deviceId, setDeviceId] = useState<string>("");
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [banner, setBanner] = useState<{ tone: "info" | "warning" | "error"; message: string } | null>(null);
  const canManage = isAdmin || isOwner || isFacilities;

  const fleetQuery = useQuery({
    queryKey: ["fleet", currentOrgId, "sharing"],
    queryFn: () => fetchFleet({ orgId: currentOrgId ?? undefined }),
  });

  const sites = fleetQuery.data?.sites ?? [];
  const devices = fleetQuery.data?.devices ?? [];

  useEffect(() => {
    if (!siteId && sites.length > 0) {
      setSiteId(sites[0].id);
    }
  }, [siteId, sites]);

  const filteredDevices = useMemo(() => {
    if (scope === "device" && siteId) {
      return devices.filter((device) => device.site_id === siteId);
    }
    if (siteId) {
      return devices.filter((device) => device.site_id === siteId);
    }
    return devices;
  }, [devices, scope, siteId]);

  useEffect(() => {
    if (scope !== "device") return;
    const fallback = filteredDevices[0]?.id ?? "";
    if (!deviceId || !filteredDevices.find((device) => device.id === deviceId)) {
      setDeviceId(fallback);
    }
  }, [deviceId, filteredDevices, scope]);

  const activeScopeId = scope === "site" ? siteId : deviceId;
  const linksQuery = useQuery({
    queryKey: ["share-links", scope, activeScopeId, currentOrgId],
    enabled: !!activeScopeId,
    queryFn: () => listShareLinks(scope, activeScopeId as string),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!activeScopeId) throw new Error("Missing scope");
      const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
      return createShareLink({ scope, id: activeScopeId, expiresAt, permissions: "read_only" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share-links", scope, activeScopeId, currentOrgId] });
      setBanner({ tone: "info", message: "Share link created." });
    },
    onError: () => setBanner({ tone: "error", message: "Could not create share link right now." }),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeShareLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share-links", scope, activeScopeId, currentOrgId] });
      setBanner({ tone: "info", message: "Share link revoked." });
    },
    onError: () => setBanner({ tone: "error", message: "Could not revoke this share link." }),
  });

  const handleCreate = () => {
    if (!canManage) {
      setBanner({ tone: "warning", message: "Contractors can view share links but cannot create them." });
      return;
    }
    if (!activeScopeId) {
      setBanner({ tone: "warning", message: "Select a site or device to create a link." });
      return;
    }
    createMutation.mutate();
  };

  const handleRevoke = (id: string, status: ShareLinkStatus) => {
    if (status !== "active") return;
    if (!canManage) {
      setBanner({ tone: "warning", message: "You do not have permission to revoke share links." });
      return;
    }
    revokeMutation.mutate(id);
  };

  const handleCopy = async (link: ShareLink) => {
    if (resolveStatus(link) !== "active") return;
    const url = shareUrlFor(link.token);
    try {
      await navigator.clipboard?.writeText?.(url);
      setBanner({ tone: "info", message: "Copied link to clipboard." });
    } catch {
      setBanner({
        tone: "warning",
        message: "Copy unavailable in this browser. Copy the URL from the table instead.",
      });
    }
  };

  const links = linksQuery.data ?? [];
  const isLoading = linksQuery.isLoading || fleetQuery.isLoading;
  const isError = linksQuery.isError || fleetQuery.isError;
  const isEmpty = !isLoading && links.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: theme.spacing.md, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, color: theme.colors.textSecondary }}>Sharing</p>
            <h2 style={{ margin: 0 }}>Share links</h2>
            <p style={{ margin: 0, color: theme.colors.textSecondary }}>
              Create read-only links for sites or devices. Owners, admins, and facilities can manage them.
            </p>
          </div>
          {!canManage ? (
            <Badge tone="warning" data-testid="share-links-readonly">
              Contractors can view only
            </Badge>
          ) : null}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: theme.spacing.sm,
            marginTop: theme.spacing.md,
            alignItems: "flex-end",
          }}
        >
          <label style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize, display: "flex", flexDirection: "column", gap: 6 }}>
            Scope
            <select
              value={scope}
              onChange={(evt) => setScope(evt.target.value as Scope)}
              style={{
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                background: theme.colors.surfaceAlt,
                color: theme.colors.textPrimary,
              }}
            >
              <option value="site">Site</option>
              <option value="device">Device</option>
            </select>
          </label>

          <label style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize, display: "flex", flexDirection: "column", gap: 6 }}>
            Site
            <select
              value={siteId}
              onChange={(evt) => setSiteId(evt.target.value)}
              style={{
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                background: theme.colors.surfaceAlt,
                color: theme.colors.textPrimary,
              }}
            >
              <option value="" disabled>
                Select a site
              </option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize, display: "flex", flexDirection: "column", gap: 6 }}>
            Device (optional)
            <select
              value={deviceId}
              onChange={(evt) => setDeviceId(evt.target.value)}
              disabled={scope === "site"}
              style={{
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                background: theme.colors.surfaceAlt,
                color: theme.colors.textPrimary,
                opacity: scope === "site" ? 0.6 : 1,
              }}
            >
              <option value="" disabled>
                Select a device
              </option>
              {filteredDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize, display: "flex", flexDirection: "column", gap: 6 }}>
            Expiry
            <select
              value={expiryDays}
              onChange={(evt) => setExpiryDays(Number(evt.target.value))}
              style={{
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                background: theme.colors.surfaceAlt,
                color: theme.colors.textPrimary,
              }}
            >
              <option value={1}>24 hours</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
            </select>
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              onClick={handleCreate}
              disabled={!canManage || !activeScopeId || createMutation.isPending}
              aria-label="Create share link"
            >
              {createMutation.isPending ? "Creating..." : "Create link"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        {banner ? (
          <div
            style={{
              marginBottom: theme.spacing.sm,
              padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
              borderRadius: theme.radius.md,
              border: `1px solid ${
                banner.tone === "error" ? theme.colors.error : banner.tone === "warning" ? theme.colors.warning : theme.colors.info
              }`,
              background:
                banner.tone === "error"
                  ? theme.colors.errorSoft
                  : banner.tone === "warning"
                    ? theme.colors.warningSoft
                    : theme.colors.infoSoft,
              color:
                banner.tone === "error"
                  ? theme.colors.error
                  : banner.tone === "warning"
                    ? theme.colors.warning
                    : theme.colors.info,
              display: "flex",
              justifyContent: "space-between",
              gap: theme.spacing.sm,
            }}
          >
            <span>{banner.message}</span>
            <Button size="sm" variant="ghost" onClick={() => setBanner(null)}>
              Dismiss
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          <div style={{ color: theme.colors.textSecondary }}>Loading share links...</div>
        ) : isError ? (
          <div style={{ color: theme.colors.error }}>Could not load share links.</div>
        ) : isEmpty ? (
          <div style={{ color: theme.colors.textSecondary }} data-testid="share-links-empty">
            No active share links yet.
          </div>
        ) : (
          <div role="table" aria-label="Share links" style={{ width: "100%" }}>
            <div
              role="row"
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 180px 180px 120px 200px",
                gap: theme.spacing.sm,
                padding: `${theme.spacing.sm}px 0`,
                color: theme.colors.textSecondary,
                fontSize: theme.typography.caption.fontSize,
                borderBottom: `1px solid ${theme.colors.borderSubtle}`,
              }}
            >
              <span>Target</span>
              <span>Created by</span>
              <span>Created</span>
              <span>Expires</span>
              <span>Status</span>
              <span style={{ textAlign: "right" }}>Actions</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {links.map((link) => {
                const status = resolveStatus(link);
                const scopeLabel =
                  link.scopeType === "device"
                    ? `Device: ${devices.find((d) => d.id === link.scopeId)?.name ?? link.scopeId}`
                    : `Site: ${sites.find((s) => s.id === link.scopeId)?.name ?? link.scopeId}`;
                const shareUrl = shareUrlFor(link.token);
                const revokeDisabled = status !== "active" || !canManage || revokeMutation.isPending;

                return (
                  <div
                    key={link.id}
                    role="row"
                    data-testid="share-link-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 1fr 180px 180px 120px 200px",
                      gap: theme.spacing.sm,
                      padding: `${theme.spacing.sm}px 0`,
                      borderBottom: `1px solid ${theme.colors.borderSubtle}`,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <strong>{scopeLabel}</strong>
                      <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>{shareUrl}</span>
                    </div>
                    <span style={{ color: theme.colors.textSecondary }}>
                      {link.createdBy?.name || link.createdBy?.email || "Unknown"}
                    </span>
                    <span style={{ color: theme.colors.textSecondary }}>{formatDateTime(link.createdAt)}</span>
                    <span style={{ color: theme.colors.textSecondary }}>{formatDateTime(link.expiresAt)}</span>
                    <Badge tone={statusTone(status)}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: theme.spacing.xs }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={status !== "active"}
                        onClick={() => handleCopy(link)}
                      >
                        Copy link
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={revokeDisabled}
                        onClick={() => handleRevoke(link.id, status)}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
