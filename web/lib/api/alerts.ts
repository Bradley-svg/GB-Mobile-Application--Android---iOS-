import { api } from "./httpClient";
import type { Alert, AlertRule, AlertSeverity, AlertStatus } from "@/lib/types/alerts";

type ListAlertsParams = {
  orgId?: string | null;
  status?: AlertStatus | "open" | "resolved" | "all";
  severity?: AlertSeverity;
  cursor?: string | null;
  limit?: number;
};

const toApiStatus = (status?: ListAlertsParams["status"]): AlertStatus | undefined => {
  if (!status || status === "all") return undefined;
  if (status === "open") return "active";
  if (status === "resolved") return "cleared";
  return status;
};

export async function listAlerts(params: ListAlertsParams = {}): Promise<Alert[]> {
  const res = await api.get<Alert[]>("/alerts", {
    params: {
      status: toApiStatus(params.status),
      severity: params.severity,
      cursor: params.cursor ?? undefined,
      limit: params.limit ?? undefined,
      orgId: params.orgId ?? undefined,
    },
  });
  return res.data;
}

export async function getAlert(alertId: string, orgId?: string | null): Promise<Alert | null> {
  const [active, cleared] = await Promise.all([
    listAlerts({ orgId, status: "active", limit: 200 }),
    listAlerts({ orgId, status: "cleared", limit: 200 }),
  ]);

  return active.find((alert) => alert.id === alertId) ?? cleared.find((alert) => alert.id === alertId) ?? null;
}

export async function ackAlert(alertId: string, orgId?: string | null): Promise<Alert> {
  const res = await api.post<Alert>(`/alerts/${alertId}/acknowledge`, {}, { params: { orgId: orgId ?? undefined } });
  return res.data;
}

export async function muteAlert(alertId: string, orgId: string | null | undefined, durationMinutes: number): Promise<Alert> {
  const res = await api.post<Alert>(
    `/alerts/${alertId}/mute`,
    { minutes: durationMinutes },
    { params: { orgId: orgId ?? undefined } },
  );
  return res.data;
}

export async function snoozeAlert(alertId: string, orgId: string | null | undefined, durationMinutes: number): Promise<Alert> {
  return muteAlert(alertId, orgId, durationMinutes);
}

export async function listAlertRulesForDevice(deviceId: string, orgId?: string | null): Promise<AlertRule[]> {
  const res = await api.get<AlertRule[]>(`/devices/${deviceId}/alert-rules`, {
    params: { orgId: orgId ?? undefined },
  });
  return res.data;
}

export async function listAlertRulesForSite(siteId: string, orgId?: string | null): Promise<AlertRule[]> {
  const res = await api.get<AlertRule[]>(`/sites/${siteId}/alert-rules`, {
    params: { orgId: orgId ?? undefined },
  });
  return res.data;
}
