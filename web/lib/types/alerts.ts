export type AlertSeverity = "info" | "warning" | "critical";

export type AlertStatus = "active" | "cleared";

export type Alert = {
  id: string;
  site_id: string | null;
  site_name?: string | null;
  device_id: string | null;
  device_name?: string | null;
  severity: AlertSeverity;
  type: string;
  message: string;
  status: AlertStatus;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  muted_until: string | null;
  rule_id: string | null;
  rule_name?: string | null;
};

export type AlertRule = {
  id: string;
  org_id: string;
  site_id: string | null;
  device_id: string | null;
  metric: string;
  rule_type: string;
  threshold: number | null;
  roc_window_sec: number | null;
  offline_grace_sec: number | null;
  enabled: boolean;
  severity: AlertSeverity;
  snooze_default_sec: number | null;
  name: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};
