import { getDemoMetadataForOrganisation } from '../repositories/demoRepository';

export type DemoStatus = {
  isDemoOrg: boolean;
  heroDeviceId: string | null;
  heroDeviceMac: string | null;
  seededAt: Date | null;
};

export async function getDemoStatusForOrg(organisationId: string): Promise<DemoStatus> {
  const row = await getDemoMetadataForOrganisation(organisationId);
  if (!row) {
    return {
      isDemoOrg: false,
      heroDeviceId: null,
      heroDeviceMac: null,
      seededAt: null,
    };
  }

  return {
    isDemoOrg: Boolean(row.is_demo_org),
    heroDeviceId: row.hero_device_id ?? null,
    heroDeviceMac: row.hero_device_mac ?? null,
    seededAt: row.demo_seeded_at ?? null,
  };
}
