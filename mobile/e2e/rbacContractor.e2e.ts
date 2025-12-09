import { device, element, by, expect, waitFor } from 'detox';

describe('Contractor permissions', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true });
  });

  it('sees gauges but cannot control', async () => {
    await waitFor(element(by.id('LoginScreen'))).toBeVisible().withTimeout(30000);
    await element(by.id('login-email')).replaceText('contractor@greenbro.com');
    await element(by.id('login-password')).replaceText('password');
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(40000);

    const firstSite = element(by.id('site-card')).atIndex(0);
    await waitFor(firstSite).toBeVisible().withTimeout(20000);
    await firstSite.tap();

    await waitFor(element(by.id('SiteOverviewScreen'))).toBeVisible().withTimeout(20000);

    const firstDevice = element(by.id('device-card')).atIndex(0);
    await waitFor(firstDevice).toBeVisible().withTimeout(20000);
    await firstDevice.tap();

    await waitFor(element(by.id('DeviceDetailScreen'))).toBeVisible().withTimeout(20000);
    await waitFor(element(by.id('device-gauges-card'))).toBeVisible().withTimeout(20000);
    await waitFor(element(by.id('compressor-current-card'))).toBeVisible().withTimeout(20000);

    await expect(element(by.id('setpoint-button'))).toBeVisible();
    await expect(element(by.id('setpoint-button'))).toBeDisabled();
    await expect(element(by.text('Read-only access for your role.'))).toBeVisible();
  });
});
