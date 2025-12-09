import { device, element, by, expect, waitFor } from 'detox';

describe('Greenbro core navigation', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('logs in and navigates Dashboard → Site → Device → Alerts → Profile → Logout', async () => {
    await waitFor(element(by.id('LoginScreen'))).toBeVisible().withTimeout(30000);

    await element(by.id('login-email')).replaceText('demo@greenbro.com');
    await element(by.id('login-password')).replaceText('password');
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(40000);

    const firstSiteCard = element(by.id('site-card')).atIndex(0);
    await waitFor(firstSiteCard).toBeVisible().withTimeout(15000);
    await firstSiteCard.tap();

    await waitFor(element(by.id('SiteOverviewScreen'))).toBeVisible().withTimeout(20000);

    const firstDeviceCard = element(by.id('device-card')).atIndex(0);
    await waitFor(firstDeviceCard).toBeVisible().withTimeout(15000);
    await firstDeviceCard.tap();

    await waitFor(element(by.id('DeviceDetailScreen'))).toBeVisible().withTimeout(20000);
    await waitFor(element(by.id('device-gauges-card'))).toExist().withTimeout(20000);
    await expect(element(by.id('semi-circular-gauge-compressor'))).toExist();
    await expect(element(by.id('compressor-current-card'))).toExist();

    await element(by.id('device-back-button')).tap();
    await waitFor(element(by.id('SiteOverviewScreen'))).toBeVisible().withTimeout(10000);
    await element(by.id('site-back-button')).tap();
    await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(15000);

    await element(by.id('tab-alerts')).tap();
    await waitFor(element(by.id('AlertsScreen'))).toBeVisible().withTimeout(20000);
    await waitFor(element(by.id('alert-card')).atIndex(0)).toBeVisible().withTimeout(20000);
    await element(by.id('alert-card')).atIndex(0).tap();

    await waitFor(element(by.id('AlertDetailScreen'))).toBeVisible().withTimeout(20000);
    await expect(element(by.id('alert-detail-meta'))).toBeVisible();

    await element(by.id('alert-back-button')).tap();
    await waitFor(element(by.id('AlertsScreen'))).toBeVisible().withTimeout(10000);

    await element(by.id('tab-profile')).tap();
    await waitFor(element(by.id('ProfileScreen'))).toBeVisible().withTimeout(15000);
    await expect(element(by.id('profile-email'))).toBeVisible();
    await element(by.id('logout-button')).tap();

    await waitFor(element(by.id('LoginScreen'))).toBeVisible().withTimeout(15000);
  });
});
