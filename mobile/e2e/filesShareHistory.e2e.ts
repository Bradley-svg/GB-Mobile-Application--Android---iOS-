import { device, element, by, expect, waitFor } from 'detox';

async function loginAsDemo() {
  await waitFor(element(by.id('LoginScreen'))).toBeVisible().withTimeout(30000);
  await element(by.id('login-email')).replaceText('demo@greenbro.com');
  await element(by.id('login-password')).replaceText('password');
  await element(by.id('login-button')).tap();
  await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(40000);
}

async function openFirstSite() {
  const firstSiteCard = element(by.id('site-card')).atIndex(0);
  await waitFor(firstSiteCard).toBeVisible().withTimeout(20000);
  await firstSiteCard.tap();
  await waitFor(element(by.id('SiteOverviewScreen'))).toBeVisible().withTimeout(20000);
}

describe('Files, sharing, alerts, and history', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('walks core content flows for documents, share links, alerts, and history', async () => {
    await loginAsDemo();
    await openFirstSite();

    // Documents for the site
    await element(by.id('site-documents-link')).tap();
    await waitFor(element(by.id('DocumentsScreen'))).toBeVisible().withTimeout(15000);
    await waitFor(element(by.id('document-row'))).toBeVisible().withTimeout(10000);
    await element(by.id('documents-back-button')).tap();

    // Device detail drill-down with history section
    const firstDevice = element(by.id('device-card')).atIndex(0);
    await waitFor(firstDevice).toBeVisible().withTimeout(15000);
    await firstDevice.tap();
    await waitFor(element(by.id('DeviceDetailScreen'))).toBeVisible().withTimeout(20000);
    const historyChart = element(by.id('heatPumpHistoryChart'));
    const historyError = element(by.id('history-error'));
    await waitFor(historyChart).toExist().withTimeout(8000).catch(async () => {
      await waitFor(historyError).toBeVisible().withTimeout(5000);
    });
    await element(by.id('device-back-button')).tap();
    await waitFor(element(by.id('SiteOverviewScreen'))).toBeVisible().withTimeout(10000);
    await element(by.id('site-back-button')).tap();
    await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(15000);

    // Share links management from Profile
    await element(by.id('tab-profile')).tap();
    await waitFor(element(by.id('ProfileScreen'))).toBeVisible().withTimeout(15000);
    await element(by.id('sharing-row')).tap();
    await waitFor(element(by.id('SharingScreen'))).toBeVisible().withTimeout(15000);
    const manageSiteShare = element(by.id('manage-site-share')).atIndex(0);
    await waitFor(manageSiteShare).toBeVisible().withTimeout(15000);
    await manageSiteShare.tap();
    await waitFor(element(by.id('ShareLinksScreen'))).toBeVisible().withTimeout(15000);
    await waitFor(element(by.id('share-link-row'))).toBeVisible().withTimeout(10000);
    await element(by.id('create-share-link')).atIndex(0).tap();
    await element(by.id('revoke-share-link')).atIndex(0).tap();
    await device.pressBack(); // back to sharing list
    await waitFor(element(by.id('SharingScreen'))).toBeVisible().withTimeout(5000);
    await element(by.id('tab-dashboard')).tap();
    await waitFor(element(by.id('DashboardScreen'))).toBeVisible().withTimeout(15000);

    // Work order attachments entry point
    await element(by.id('tab-profile')).tap();
    await waitFor(element(by.id('ProfileScreen'))).toBeVisible().withTimeout(10000);
    await element(by.id('workorders-row')).tap();
    await waitFor(element(by.id('WorkOrdersScreen'))).toBeVisible().withTimeout(15000);
    const firstWorkOrder = element(by.id('work-order-card')).atIndex(0);
    await waitFor(firstWorkOrder).toBeVisible().withTimeout(15000);
    await firstWorkOrder.tap();
    await waitFor(element(by.id('WorkOrderDetailScreen'))).toBeVisible().withTimeout(15000);
    await expect(element(by.id('add-attachment-button'))).toBeVisible();
    await element(by.id('workorder-back-button')).tap();
    await element(by.id('tab-dashboard')).tap();

    // Alert acknowledgment flow
    await element(by.id('tab-alerts')).tap();
    await waitFor(element(by.id('AlertsScreen'))).toBeVisible().withTimeout(15000);
    const firstAlert = element(by.id('alert-card')).atIndex(0);
    await waitFor(firstAlert).toBeVisible().withTimeout(15000);
    await firstAlert.tap();
    await waitFor(element(by.id('AlertDetailScreen'))).toBeVisible().withTimeout(15000);
    await element(by.id('acknowledge-button')).tap();
    await element(by.id('alert-back-button')).tap();
  });
});
