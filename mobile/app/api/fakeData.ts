export type FakeSite = {
  id: string;
  name: string;
  status: 'OK' | 'Warning' | 'Critical';
  lastSeenAt: string;
  city: string;
};

export type FakeDevice = {
  id: string;
  siteId: string;
  name: string;
  type: string;
  status: 'OK' | 'Warning' | 'Critical';
  lastSeenAt: string;
};

export const fakeSites: FakeSite[] = [
  {
    id: 'site-1',
    name: 'Greenbro HQ',
    status: 'OK',
    lastSeenAt: new Date().toISOString(),
    city: 'Johannesburg',
  },
  {
    id: 'site-2',
    name: 'Client Mall',
    status: 'Warning',
    lastSeenAt: new Date().toISOString(),
    city: 'Cape Town',
  },
];

export const fakeDevices: FakeDevice[] = [
  {
    id: 'dev-1',
    siteId: 'site-1',
    name: 'Heat Pump 1',
    type: 'heat_pump',
    status: 'OK',
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: 'dev-2',
    siteId: 'site-1',
    name: 'Heat Pump 2',
    type: 'heat_pump',
    status: 'Warning',
    lastSeenAt: new Date().toISOString(),
  },
];

export function getFakeDevicesForSite(siteId: string) {
  return fakeDevices.filter((d) => d.siteId === siteId);
}

export function getFakeDevice(deviceId: string) {
  return fakeDevices.find((d) => d.id === deviceId) || null;
}
