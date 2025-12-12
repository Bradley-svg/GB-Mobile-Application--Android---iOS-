export type VendorFlags = {
  prodLike: boolean;
  disabled: string[];
  mqttDisabled: boolean;
  controlDisabled: boolean;
  heatPumpHistoryDisabled: boolean;
  pushNotificationsDisabled: boolean;
};

export type DemoStatus = {
  isDemoOrg: boolean;
  heroDeviceId: string | null;
  heroDeviceMac: string | null;
  seededAt: string | null;
  vendorFlags?: VendorFlags;
};
