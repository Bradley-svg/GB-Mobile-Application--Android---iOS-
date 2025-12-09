import { query } from '../config/db';

export type AlertRuleType =
  | 'threshold_above'
  | 'threshold_below'
  | 'rate_of_change'
  | 'offline_window'
  | 'composite';

export type AlertRuleSeverity = 'warning' | 'critical';

export type AlertRuleRow = {
  id: string;
  org_id: string;
  site_id: string | null;
  device_id: string | null;
  metric: string;
  rule_type: AlertRuleType;
  threshold: number | null;
  roc_window_sec: number | null;
  offline_grace_sec: number | null;
  enabled: boolean;
  severity: AlertRuleSeverity;
  snooze_default_sec: number | null;
  name: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type InsertAlertRuleInput = {
  orgId: string;
  siteId?: string | null;
  deviceId?: string | null;
  metric: string;
  ruleType: AlertRuleType;
  threshold?: number | null;
  rocWindowSec?: number | null;
  offlineGraceSec?: number | null;
  enabled?: boolean;
  severity?: AlertRuleSeverity;
  snoozeDefaultSec?: number | null;
  name?: string | null;
  description?: string | null;
};

export type UpdateAlertRuleInput = Partial<Omit<InsertAlertRuleInput, 'orgId'>>;

const baseSelect = `
  select id,
         org_id,
         site_id,
         device_id,
         metric,
         rule_type,
         threshold,
         roc_window_sec,
         offline_grace_sec,
         enabled,
         severity,
         snooze_default_sec,
         name,
         description,
         created_at,
         updated_at
  from alert_rules
`;

function enabledClause(includeDisabled?: boolean) {
  return includeDisabled ? '' : 'and enabled = true';
}

export async function getRulesForOrg(orgId: string, includeDisabled = false) {
  const res = await query<AlertRuleRow>(
    `
    ${baseSelect}
    where org_id = $1
      ${enabledClause(includeDisabled)}
    order by updated_at desc
  `,
    [orgId]
  );
  return res.rows;
}

export async function getRulesForSite(siteId: string, includeDisabled = false) {
  const res = await query<AlertRuleRow>(
    `
    ${baseSelect}
    where site_id = $1
      ${enabledClause(includeDisabled)}
    order by updated_at desc
  `,
    [siteId]
  );
  return res.rows;
}

export async function getRulesForDevice(deviceId: string, includeDisabled = false) {
  const res = await query<AlertRuleRow>(
    `
    ${baseSelect}
    where device_id = $1
      ${enabledClause(includeDisabled)}
    order by updated_at desc
  `,
    [deviceId]
  );
  return res.rows;
}

export async function insertAlertRule(input: InsertAlertRuleInput) {
  const res = await query<AlertRuleRow>(
    `
    insert into alert_rules (
      org_id,
      site_id,
      device_id,
      metric,
      rule_type,
      threshold,
      roc_window_sec,
      offline_grace_sec,
      enabled,
      severity,
      snooze_default_sec,
      name,
      description,
      created_at,
      updated_at
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, coalesce($9, true), coalesce($10, 'warning'), $11, $12, $13, now(), now()
    )
    returning *
  `,
    [
      input.orgId,
      input.siteId ?? null,
      input.deviceId ?? null,
      input.metric,
      input.ruleType,
      input.threshold ?? null,
      input.rocWindowSec ?? null,
      input.offlineGraceSec ?? null,
      input.enabled ?? true,
      input.severity ?? 'warning',
      input.snoozeDefaultSec ?? null,
      input.name ?? null,
      input.description ?? null,
    ]
  );
  return res.rows[0];
}

export async function updateAlertRule(ruleId: string, input: UpdateAlertRuleInput) {
  const fragments: string[] = [];
  const values: Array<string | number | boolean | null> = [];

  const map: Array<[keyof UpdateAlertRuleInput, string]> = [
    ['siteId', 'site_id'],
    ['deviceId', 'device_id'],
    ['metric', 'metric'],
    ['ruleType', 'rule_type'],
    ['threshold', 'threshold'],
    ['rocWindowSec', 'roc_window_sec'],
    ['offlineGraceSec', 'offline_grace_sec'],
    ['enabled', 'enabled'],
    ['severity', 'severity'],
    ['snoozeDefaultSec', 'snooze_default_sec'],
    ['name', 'name'],
    ['description', 'description'],
  ];

  map.forEach(([key, column]) => {
    const value = input[key];
    if (value !== undefined) {
      fragments.push(`${column} = $${fragments.length + 1}`);
      values.push(value);
    }
  });

  if (fragments.length === 0) {
    const res = await query<AlertRuleRow>(`${baseSelect} where id = $1`, [ruleId]);
    return res.rows[0] ?? null;
  }

  fragments.push(`updated_at = now()`);
  values.push(ruleId);

  const res = await query<AlertRuleRow>(
    `
    update alert_rules
    set ${fragments.join(', ')}
    where id = $${values.length}
    returning *
  `,
    values
  );
  return res.rows[0] ?? null;
}

export async function getAllEnabledRules(): Promise<AlertRuleRow[]> {
  const res = await query<AlertRuleRow>(`${baseSelect} where enabled = true`);
  return res.rows;
}
