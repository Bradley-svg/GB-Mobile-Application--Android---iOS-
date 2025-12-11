export type HealthPlusPayload = {
  heatPumpHistory?: {
    configured: boolean;
    disabled: boolean;
    healthy?: boolean;
    lastSuccessAt?: string | null;
    lastError?: string | null;
  };
};
