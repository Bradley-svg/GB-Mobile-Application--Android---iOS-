import { device, element, by, expect, waitFor } from 'detox';

describe('Theme persistence', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('persists dark mode selection across reload', async () => {
    const scrollContainer = by.id('DeviceDetailScroll');

    await waitFor(element(by.id('LoginScreen'))).toBeVisible().withTimeout(30000);

    await element(by.id('login-email')).replaceText('demo@greenbro.com');
    await element(by.id('login-password')).replaceText('password');
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(40000);
    await waitFor(element(by.id('dashboard-theme-toggle'))).toBeVisible().withTimeout(10000);

    await element(by.id('pill-dark')).tap();

    const firstSiteCard = element(by.id('site-card')).atIndex(0);
    await waitFor(firstSiteCard).toBeVisible().withTimeout(15000);
    await firstSiteCard.tap();

    const firstDeviceCard = element(by.id('device-card')).atIndex(0);
    await waitFor(firstDeviceCard).toBeVisible().withTimeout(15000);
    await firstDeviceCard.tap();

    await waitFor(element(by.id('DeviceDetailScreen'))).toBeVisible().withTimeout(20000);
    await waitFor(element(by.id('semi-circular-gauge-compressor'))).toExist().withTimeout(20000);
    await waitFor(element(by.id('semi-circular-gauge-compressor')))
      .toBeVisible()
      .whileElement(scrollContainer)
      .scroll(200, 'down');

    await device.reloadReactNative();

    const loginScreen = element(by.id('LoginScreen'));
    try {
      await waitFor(loginScreen).toBeVisible().withTimeout(5000);
      await element(by.id('login-email')).replaceText('demo@greenbro.com');
      await element(by.id('login-password')).replaceText('password');
      await element(by.id('login-button')).tap();
    } catch (_error) {
      // If already logged in, proceed to dashboard assertion.
    }

    await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(40000);
    await waitFor(element(by.id('current-theme-label-dark'))).toBeVisible().withTimeout(10000);

    const siteCardAfterReload = element(by.id('site-card')).atIndex(0);
    await waitFor(siteCardAfterReload).toBeVisible().withTimeout(20000);
    await siteCardAfterReload.tap();

    const deviceCardAfterReload = element(by.id('device-card')).atIndex(0);
    await waitFor(deviceCardAfterReload).toBeVisible().withTimeout(20000);
    await deviceCardAfterReload.tap();

    await waitFor(element(by.id('DeviceDetailScreen'))).toBeVisible().withTimeout(20000);
    await waitFor(element(by.id('semi-circular-gauge-compressor'))).toExist().withTimeout(20000);
    await waitFor(element(by.id('semi-circular-gauge-compressor')))
      .toBeVisible()
      .whileElement(scrollContainer)
      .scroll(200, 'down');
  });
});
