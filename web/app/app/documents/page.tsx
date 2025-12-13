"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card } from "@/components/ui";
import { getDocumentDownloadUrl, listDeviceDocuments, listSiteDocuments } from "@/lib/api/documents";
import { fetchFleet } from "@/lib/api/fleet";
import { api } from "@/lib/api/httpClient";
import { useOrgStore } from "@/lib/orgStore";
import type { Document, FileStatus } from "@/lib/types/documents";
import type { ApiDevice, ApiSite } from "@/lib/types/fleet";
import { useTheme } from "@/theme/ThemeProvider";

type ScopeFilter = "all" | "site" | "device";

const formatBytes = (value?: number | null) => {
  if (!value || Number.isNaN(value)) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
};

const statusDisplay = (status: FileStatus) =>
  ({
    clean: { label: "Clean", tone: "success" as const, helper: null },
    infected: { label: "Infected", tone: "error" as const, helper: "Download blocked after antivirus scan." },
    scan_failed: {
      label: "Scan failed",
      tone: "warning" as const,
      helper: "Download disabled until the scan succeeds.",
    },
  })[status] ?? { label: "Unknown", tone: "neutral" as const, helper: null };

const buildFileUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const base = api.defaults.baseURL || "";
  const prefix = base.replace(/\/$/, "");
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${prefix}${path}`;
};

const getFileStatus = (doc: Document): FileStatus =>
  (doc.fileStatus ?? doc.file_status ?? "clean") as FileStatus;

const ListSkeleton = () => {
  const { theme } = useTheme();
  return (
    <div data-testid="documents-skeleton" style={{ display: "flex", flexDirection: "column", gap: theme.spacing.xs }}>
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr 120px 180px 160px 140px",
            gap: theme.spacing.sm,
            padding: `${theme.spacing.sm}px 0`,
            borderBottom: `1px solid ${theme.colors.borderSubtle}`,
          }}
        >
          {Array.from({ length: 6 }).map((__, col) => (
            <div
              key={col}
              style={{
                height: 14,
                borderRadius: theme.radius.sm,
                background: theme.colors.backgroundAlt,
                animation: "pulse 1.2s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ))}
      <style>{`@keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }`}</style>
    </div>
  );
};

export default function DocumentsPage() {
  const { theme } = useTheme();
  const currentOrgId = useOrgStore((s) => s.currentOrgId);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const fleetQuery = useQuery({
    queryKey: ["fleet", currentOrgId, "documents"],
    queryFn: () => fetchFleet({ orgId: currentOrgId ?? undefined }),
  });

  const sites = useMemo(() => fleetQuery.data?.sites ?? [], [fleetQuery.data]);
  const devices = useMemo(() => fleetQuery.data?.devices ?? [], [fleetQuery.data]);

  const siteMap = useMemo(() => new Map((sites as ApiSite[]).map((site) => [site.id, site])), [sites]);
  const deviceMap = useMemo(() => new Map((devices as ApiDevice[]).map((device) => [device.id, device])), [devices]);

  const filteredDevices = useMemo(() => {
    if (siteFilter === "all") return devices;
    return devices.filter((device) => device.site_id === siteFilter);
  }, [devices, siteFilter]);

  const documentsQuery = useQuery({
    queryKey: ["documents", scopeFilter, siteFilter, deviceFilter, typeFilter, currentOrgId],
    enabled: fleetQuery.isSuccess,
    queryFn: async () => {
      const siteIds =
        scopeFilter === "device"
          ? []
          : siteFilter === "all"
            ? sites.map((site) => site.id)
            : siteFilter
              ? [siteFilter]
              : [];

      const deviceIds =
        scopeFilter === "site"
          ? []
          : deviceFilter === "all"
            ? filteredDevices.map((device) => device.id)
            : deviceFilter
              ? [deviceFilter]
              : [];

      const requests: Promise<Document[]>[] = [];
      siteIds.forEach((id) => {
        requests.push(
          listSiteDocuments(id, currentOrgId).then((docs) =>
            docs.map((doc) => ({ ...doc, siteId: doc.siteId ?? doc.site_id ?? id, scopeType: "site" })),
          ),
        );
      });
      deviceIds.forEach((id) => {
        requests.push(
          listDeviceDocuments(id, currentOrgId).then((docs) =>
            docs.map((doc) => ({ ...doc, deviceId: doc.deviceId ?? doc.device_id ?? id, scopeType: "device" })),
          ),
        );
      });

      const results = await Promise.all(requests);
      let combined = results.flat();

      if (typeFilter !== "all") {
        const normalized = typeFilter.toLowerCase();
        combined = combined.filter((doc) => (doc.category ?? "other").toLowerCase() === normalized);
      }

      combined.sort((a, b) => {
        const aTime = new Date(a.createdAt ?? a.created_at ?? "").getTime() || 0;
        const bTime = new Date(b.createdAt ?? b.created_at ?? "").getTime() || 0;
        return bTime - aTime;
      });

      return combined;
    },
  });

  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    documents.forEach((doc) => {
      if (doc.category) categories.add(doc.category);
    });
    return ["all", ...Array.from(categories).sort()];
  }, [documents]);

  const resolveScopeLabel = (doc: Document) => {
    const deviceId = doc.deviceId ?? doc.device_id ?? null;
    const siteId = doc.siteId ?? doc.site_id ?? null;
    if (deviceId) {
      const device = deviceMap.get(deviceId);
      const siteName = device?.site_name || (device ? siteMap.get(device.site_id)?.name : null);
      return device ? `Device: ${device.name}${siteName ? ` (${siteName})` : ""}` : "Device document";
    }
    if (siteId) {
      const site = siteMap.get(siteId);
      return site ? `Site: ${site.name}` : "Site document";
    }
    return "Organisation";
  };

  const handleDownload = async (doc: Document) => {
    const status = getFileStatus(doc);
    const statusMeta = statusDisplay(status);
    if (status !== "clean") {
      setDownloadError(statusMeta.helper ?? "Download disabled for this document.");
      return;
    }
    setDownloadError(null);
    try {
      const signedUrl = await getDocumentDownloadUrl(doc);
      const target = buildFileUrl(signedUrl || doc.url);
      if (!target) {
        setDownloadError("Document URL is unavailable.");
        return;
      }
      window.open(target, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      setDownloadError("Could not generate a download link right now.");
    }
  };

  const isLoading = documentsQuery.isLoading || fleetQuery.isLoading;
  const isError = documentsQuery.isError || fleetQuery.isError;
  const isEmpty = !isLoading && documents.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: theme.spacing.md, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, color: theme.colors.textSecondary }}>Documents</p>
            <h2 style={{ margin: 0 }}>My org&apos;s documents</h2>
            <p style={{ margin: 0, color: theme.colors.textSecondary }}>
              Read or download documents per site or device. Downloads use signed URLs and antivirus status.
            </p>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: theme.spacing.sm,
            marginTop: theme.spacing.md,
          }}
        >
          <label style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize, display: "flex", flexDirection: "column", gap: 6 }}>
            Scope
            <select
              value={scopeFilter}
              onChange={(evt) => setScopeFilter(evt.target.value as ScopeFilter)}
              style={{
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                background: theme.colors.surfaceAlt,
                color: theme.colors.textPrimary,
              }}
            >
              <option value="all">All documents</option>
              <option value="site">Site documents</option>
              <option value="device">Device documents</option>
            </select>
          </label>

          <label style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize, display: "flex", flexDirection: "column", gap: 6 }}>
            Site filter
            <select
              value={siteFilter}
              onChange={(evt) => setSiteFilter(evt.target.value)}
              style={{
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                background: theme.colors.surfaceAlt,
                color: theme.colors.textPrimary,
              }}
            >
              <option value="all">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize, display: "flex", flexDirection: "column", gap: 6 }}>
            Device filter
            <select
              value={deviceFilter}
              onChange={(evt) => setDeviceFilter(evt.target.value)}
              disabled={scopeFilter === "site"}
              style={{
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                background: theme.colors.surfaceAlt,
                color: theme.colors.textPrimary,
                opacity: scopeFilter === "site" ? 0.6 : 1,
              }}
            >
              <option value="all">All devices</option>
              {filteredDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize, display: "flex", flexDirection: "column", gap: 6 }}>
            Type
            <select
              value={typeFilter}
              onChange={(evt) => setTypeFilter(evt.target.value)}
              style={{
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.borderSubtle}`,
                background: theme.colors.surfaceAlt,
                color: theme.colors.textPrimary,
              }}
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category === "all" ? "All types" : category}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card>
        {downloadError ? (
          <div
            data-testid="documents-error-banner"
            style={{
              marginBottom: theme.spacing.sm,
              padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.colors.warning}`,
              background: theme.colors.warningSoft,
              color: theme.colors.warning,
              display: "flex",
              justifyContent: "space-between",
              gap: theme.spacing.sm,
            }}
          >
            <span>{downloadError}</span>
            <Button size="sm" variant="ghost" onClick={() => setDownloadError(null)}>
              Dismiss
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          <ListSkeleton />
        ) : isError ? (
          <div style={{ color: theme.colors.error }}>Could not load documents. Please retry shortly.</div>
        ) : isEmpty ? (
          <div style={{ color: theme.colors.textSecondary }}>No documents found for this selection.</div>
        ) : (
          <div role="table" aria-label="Documents" style={{ width: "100%" }}>
            <div
              role="row"
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 120px 180px 160px 140px",
                gap: theme.spacing.sm,
                padding: `${theme.spacing.sm}px 0`,
                color: theme.colors.textSecondary,
                fontSize: theme.typography.caption.fontSize,
                borderBottom: `1px solid ${theme.colors.borderSubtle}`,
              }}
            >
              <span>Name</span>
              <span>Scope</span>
              <span>Size</span>
              <span>Uploaded</span>
              <span>AV status</span>
              <span style={{ textAlign: "right" }}>Actions</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {documents.map((doc) => {
                const status = getFileStatus(doc);
                const statusMeta = statusDisplay(status);
                const scopeLabel = resolveScopeLabel(doc);

                return (
                  <div
                    key={doc.id}
                    role="row"
                    data-testid="document-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr 120px 180px 160px 140px",
                      gap: theme.spacing.sm,
                      padding: `${theme.spacing.sm}px 0`,
                      borderBottom: `1px solid ${theme.colors.borderSubtle}`,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <strong>{doc.title}</strong>
                      <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize }}>
                        {doc.category ? doc.category : "Other"}
                      </span>
                    </div>
                    <span style={{ color: theme.colors.textSecondary }}>{scopeLabel}</span>
                    <span style={{ color: theme.colors.textSecondary }}>{formatBytes(doc.sizeBytes ?? doc.size_bytes ?? null)}</span>
                    <span style={{ color: theme.colors.textSecondary }}>{formatDateTime(doc.createdAt ?? doc.created_at)}</span>
                    <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        data-testid={`download-btn-${doc.id}`}
                        disabled={status !== "clean"}
                        onClick={() => handleDownload(doc)}
                      >
                        Download
                      </Button>
                    </div>
                    {statusMeta.helper ? (
                      <span
                        style={{
                          gridColumn: "1 / span 6",
                          color: theme.colors.textSecondary,
                          fontSize: theme.typography.caption.fontSize,
                        }}
                      >
                        {statusMeta.helper}
                      </span>
                    ) : null}
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
