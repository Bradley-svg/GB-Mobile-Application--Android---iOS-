export type SystemStatus = {
  key: string;
  payload: Record<string, unknown>;
  mqtt_last_ingest_at: Date | null;
  mqtt_last_error_at: Date | null;
  mqtt_last_error: string | null;
  control_last_command_at: Date | null;
  control_last_error_at: Date | null;
  control_last_error: string | null;
  alerts_worker_last_heartbeat_at: Date | null;
  push_last_sample_at: Date | null;
  push_last_error: string | null;
  heat_pump_history_last_success_at: Date | null;
  heat_pump_history_last_error_at: Date | null;
  heat_pump_history_last_error: string | null;
  updated_at: Date;
};
