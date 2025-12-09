import { device, element, by, expect, waitFor } from 'detox';

const loginIfNeeded = async (email: string, password: string) => {
  const loginScreen = element(by.id('LoginScreen'));
  try {
    await waitFor(loginScreen).toBeVisible().withTimeout(8000);
  } catch {
    return;
  }

  await element(by.id('login-email')).replaceText(email);
  await element(by.id('login-password')).replaceText(password);
  await element(by.id('login-button')).tap();
  await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(30000);
};

const openFirstDevice = async () => {
  const firstSite = element(by.id('site-card')).atIndex(0);
  await waitFor(firstSite).toBeVisible().withTimeout(20000);
  await firstSite.tap();

  await waitFor(element(by.id('SiteOverviewScreen'))).toBeVisible().withTimeout(20000);

  const firstDevice = element(by.id('device-card')).atIndex(0);
  await waitFor(firstDevice).toBeVisible().withTimeout(20000);
  await firstDevice.tap();

  await waitFor(element(by.id('DeviceDetailScreen'))).toBeVisible().withTimeout(20000);
};

describe('Theme + gauges', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true });
  });

  it('keeps dark mode and shows gauges after reload', async () => {
    await waitFor(element(by.id('LoginScreen'))).toBeVisible().withTimeout(30000);
    await element(by.id('login-email')).replaceText('demo@greenbro.com');
    await element(by.id('login-password')).replaceText('password');
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(40000);
    await waitFor(element(by.id('dashboard-theme-toggle'))).toBeVisible().withTimeout(10000);
    await element(by.id('pill-dark')).tap();
    await expect(element(by.id('current-theme-label-dark'))).toBeVisible();

    await openFirstDevice();

    await waitFor(element(by.id('device-gauges-card'))).toBeVisible().withTimeout(20000);
    await waitFor(element(by.id('compressor-current-card'))).toBeVisible().withTimeout(20000);

    await device.reloadReactNative();

    await loginIfNeeded('demo@greenbro.com', 'password');

    try {
      await waitFor(element(by.id('DeviceDetailScreen'))).toBeVisible().withTimeout(5000);
    } catch {
      await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(30000);
      await expect(element(by.id('current-theme-label-dark'))).toBeVisible();
      await openFirstDevice();
    }

    await expect(element(by.id('device-gauges-card'))).toBeVisible();
    await expect(element(by.id('compressor-current-card'))).toBeVisible();
    await expect(element(by.id('current-theme-label-dark'))).toBeVisible();
  });
});
