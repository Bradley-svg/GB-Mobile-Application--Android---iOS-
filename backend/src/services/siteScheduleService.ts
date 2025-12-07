import { getActiveSchedulesForSite } from '../repositories/siteSchedulesRepository';

export type ScheduleContext = {
  isLoadShedding: boolean;
  isTouPeak: boolean;
};

function formatLocalTime(date: Date): string {
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export async function getScheduleContextForSite(
  siteId: string,
  at: Date = new Date()
): Promise<ScheduleContext> {
  const dayOfWeek = at.getDay(); // 0 (Sun) - 6 (Sat)
  const timeLocal = formatLocalTime(at);
  const windows = await getActiveSchedulesForSite(siteId, dayOfWeek, timeLocal);

  return {
    isLoadShedding: windows.some((w) => w.kind === 'load_shedding'),
    isTouPeak: windows.some((w) => w.kind === 'tou_peak'),
  };
}
