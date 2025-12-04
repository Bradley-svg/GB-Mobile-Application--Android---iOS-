export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'cleared';

export type AlertType = 'offline' | 'high_temp';

export type AlertRow = {
  id: string;
  site_id: string | null;
  device_id: string | null;
  severity: string;
  type: string;
  message: string;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  muted_until: string | null;
};
