import {
  getRulesForDevice,
  getRulesForOrg,
  getRulesForSite,
  type AlertRuleRow,
} from '../repositories/alertRulesRepository';

function dedupeRules(rules: AlertRuleRow[]) {
  const map = new Map<string, AlertRuleRow>();
  rules.forEach((rule) => {
    map.set(rule.id, rule);
  });
  return Array.from(map.values());
}

export async function getRulesForDeviceContext(
  deviceId: string,
  siteId: string | null,
  orgId: string
): Promise<AlertRuleRow[]> {
  const [orgRules, siteRules, deviceRules] = await Promise.all([
    getRulesForOrg(orgId),
    siteId ? getRulesForSite(siteId) : Promise.resolve([]),
    getRulesForDevice(deviceId),
  ]);

  return dedupeRules([...orgRules, ...siteRules, ...deviceRules]);
}

export async function getRulesForSiteContext(
  siteId: string,
  orgId: string
): Promise<AlertRuleRow[]> {
  const [orgRules, siteRules] = await Promise.all([getRulesForOrg(orgId), getRulesForSite(siteId)]);
  return dedupeRules([...orgRules, ...siteRules]);
}
