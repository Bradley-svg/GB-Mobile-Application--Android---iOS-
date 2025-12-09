import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import { expect as jestExpect } from '@jest/globals';

describe('Contractor permissions', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('sees gauges but cannot control', async () => {
    const scrollContainer = by.id('DeviceDetailScroll');

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
    await waitFor(element(by.id('device-gauges-card'))).toExist().withTimeout(20000);
    await waitFor(element(by.id('device-gauges-card')))
      .toBeVisible()
      .whileElement(scrollContainer)
      .scroll(200, 'down');
    await waitFor(element(by.id('compressor-current-card'))).toExist().withTimeout(20000);
    await waitFor(element(by.id('compressor-current-card')))
      .toBeVisible()
      .whileElement(scrollContainer)
      .scroll(200, 'down');

    const setpointButton = element(by.id('setpoint-button'));
    await waitFor(setpointButton).toExist().withTimeout(20000);
    await waitFor(setpointButton).toBeVisible().whileElement(scrollContainer).scroll(200, 'down');

    const setpointAttributes = await setpointButton.getAttributes();
    const enabled =
      'enabled' in setpointAttributes
        ? setpointAttributes.enabled
        : setpointAttributes.elements?.[0]?.enabled;
    jestExpect(enabled).toBe(false);

    await detoxExpect(element(by.text('Read-only access for your role.'))).toBeVisible();
  });
});
