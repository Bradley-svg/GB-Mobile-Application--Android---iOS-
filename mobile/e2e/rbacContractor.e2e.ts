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
    await element(by.id('tab-profile')).tap();
    await waitFor(element(by.id('ProfileScreen'))).toBeVisible().withTimeout(15000);
    await waitFor(element(by.text('Contractor')).atIndex(0)).toExist().withTimeout(10000);
    await element(by.id('tab-dashboard')).tap();
    await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(15000);

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

    await setpointButton.tap();
    const readOnlyMessage = element(by.id('setpoint-readonly'));
    await waitFor(readOnlyMessage).toExist().withTimeout(5000);
    await waitFor(readOnlyMessage).toBeVisible().whileElement(scrollContainer).scroll(200, 'down');
  });
});
