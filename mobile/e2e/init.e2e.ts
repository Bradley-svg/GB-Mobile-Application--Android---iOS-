jest.setTimeout(120000);

import detox, { device } from 'detox';

beforeAll(async () => {
  await detox.init();
  await device.launchApp({ delete: true, newInstance: true });
});

beforeEach(async () => {
  await device.reloadReactNative();
});

afterAll(async () => {
  await detox.cleanup();
});
