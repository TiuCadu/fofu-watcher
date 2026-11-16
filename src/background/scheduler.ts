import { getSites } from '../utils/storage';
import { checkSite } from './checker';

export const TICK_ALARM = 'fofu-tick';

export async function ensureAlarm(): Promise<void> {
  if (!(await chrome.alarms.get(TICK_ALARM))) {
    await chrome.alarms.create(TICK_ALARM, { delayInMinutes: 0.1, periodInMinutes: 1 });
  }
}

let running = false;

export async function runDue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const now = Date.now();
    const due = (await getSites()).filter((s) => s.enabled && (s.nextRun == null || s.nextRun <= now));
    for (const s of due) await checkSite(s.id);
  } finally {
    running = false;
  }
}
