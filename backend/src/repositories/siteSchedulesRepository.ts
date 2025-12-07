import { query } from '../config/db';

export type SiteScheduleRow = {
  id: string;
  site_id: string;
  day_of_week: number;
  start_time_local: string;
  end_time_local: string;
  kind: 'load_shedding' | 'tou_peak' | 'tou_offpeak' | string;
  created_at: string;
  updated_at: string;
};

export async function getSchedulesForSite(siteId: string): Promise<SiteScheduleRow[]> {
  const res = await query<SiteScheduleRow>(
    `
    select *
    from site_schedules
    where site_id = $1
    order by day_of_week asc, start_time_local asc
  `,
    [siteId]
  );
  return res.rows;
}

export async function getActiveSchedulesForSite(
  siteId: string,
  dayOfWeek: number,
  timeLocal: string
): Promise<SiteScheduleRow[]> {
  const res = await query<SiteScheduleRow>(
    `
    select *
    from site_schedules
    where site_id = $1
      and day_of_week = $2
      and start_time_local <= $3::time
      and end_time_local > $3::time
  `,
    [siteId, dayOfWeek, timeLocal]
  );
  return res.rows;
}
