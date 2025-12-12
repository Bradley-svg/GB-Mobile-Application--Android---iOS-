import { device, element, by, expect, waitFor } from 'detox';

const demoEmail = process.env.DEMO_EMAIL || 'demo@greenbro.com';
const demoPassword = process.env.DEMO_PASSWORD || 'password';

describe('Demo golden path', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('navigates the seeded demo flow end-to-end', async () => {
    await waitFor(element(by.id('LoginScreen'))).toBeVisible().withTimeout(60_000);

    await element(by.id('login-email')).replaceText(demoEmail);
    await element(by.id('login-password')).replaceText(demoPassword);
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(60_000);

    const firstSiteCard = element(by.id('site-card')).atIndex(0);
    await waitFor(firstSiteCard).toBeVisible().withTimeout(20_000);
    await firstSiteCard.tap();

    await waitFor(element(by.id('SiteOverviewScreen'))).toBeVisible().withTimeout(30_000);
    const firstDeviceCard = element(by.id('device-card')).atIndex(0);
    await waitFor(firstDeviceCard).toBeVisible().withTimeout(20_000);
    await firstDeviceCard.tap();

    await waitFor(element(by.id('DeviceDetailScreen'))).toBeVisible().withTimeout(30_000);
    await expect(element(by.id('device-gauges-card'))).toBeVisible();
    await expect(element(by.id('semi-circular-gauge-compressor'))).toExist();
    await expect(element(by.id('gauge-power'))).toExist();

    await element(by.id('pill-compressor')).tap();
    await waitFor(element(by.id('compressor-current-card'))).toBeVisible().withTimeout(20_000);
    await expect(element(by.id('pill-6h'))).toBeVisible();
    await waitFor(element(by.id('heatPumpHistoryChart'))).toExist().withTimeout(20_000);

    await element(by.id('device-back-button')).tap();
    await waitFor(element(by.id('SiteOverviewScreen'))).toBeVisible().withTimeout(15_000);
    await element(by.id('site-back-button')).tap();
    await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(15_000);

    await element(by.id('tab-profile')).tap();
    await waitFor(element(by.id('ProfileScreen'))).toBeVisible().withTimeout(20_000);
    await element(by.id('diagnostics-row')).tap();

    await waitFor(element(by.id('DiagnosticsScreen'))).toBeVisible().withTimeout(30_000);
    try {
      await expect(element(by.id('demo-mode-pill'))).toExist();
    } catch (err) {
      await expect(element(by.id('vendor-disabled-banner'))).toExist();
    }
  });
});
