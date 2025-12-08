import { device, element, by, expect, waitFor } from 'detox';

describe('Theme persistence', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('persists dark mode selection across reload', async () => {
    await waitFor(element(by.id('LoginScreen'))).toBeVisible().withTimeout(30000);

    await element(by.id('login-email')).replaceText('demo@greenbro.com');
    await element(by.id('login-password')).replaceText('password');
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(40000);
    await waitFor(element(by.id('dashboard-theme-toggle'))).toBeVisible().withTimeout(10000);

    await element(by.id('pill-dark')).tap();

    await device.reloadReactNative();

    await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(40000);
    await waitFor(element(by.id('current-theme-label-dark'))).toBeVisible().withTimeout(10000);

    await element(by.id('tab-profile')).tap();
    await waitFor(element(by.id('ProfileScreen'))).toBeVisible().withTimeout(15000);
    await element(by.id('logout-button')).tap();
  });
});
