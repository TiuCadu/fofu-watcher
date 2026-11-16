import type { Schedule, Settings } from './types';

const DAY_MS = 86_400_000;

export const parseHM = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

export const isValidHM = (s: unknown): s is string =>
  typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

function at(base: Date, minutes: number, dayOffset = 0): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

export function inWindow(m: number, start: number, end: number): boolean {
  if (start === end) return true;
  return start < end ? m >= start && m < end : m >= start || m < end;
}

export function computeNextRun(s: Schedule, from: Date): number {
  if (s.mode === 'fixed') {
    const times = [...new Set(s.times)].map(parseHM).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
    if (!times.length) return from.getTime() + DAY_MS;
    for (let off = 0; off <= 7; off++) {
      const day = at(from, 0, off);
      if (s.days.length && !s.days.includes(day.getDay())) continue;
      for (const t of times) {
        const c = at(from, t, off);
        if (c.getTime() > from.getTime()) return c.getTime();
      }
    }
    return from.getTime() + DAY_MS;
  }

  const next = new Date(from.getTime() + Math.max(1, s.everyMinutes) * 60_000);
  if (!s.windowStart || !s.windowEnd) return next.getTime();
  const ws = parseHM(s.windowStart);
  const we = parseHM(s.windowEnd);
  if (inWindow(next.getHours() * 60 + next.getMinutes(), ws, we)) return next.getTime();
  const today = at(next, ws, 0);
  return (today.getTime() > next.getTime() ? today : at(next, ws, 1)).getTime();
}

export function isDnd(settings: Settings, now: Date): boolean {
  if (!settings.dndEnabled) return false;
  return inWindow(now.getHours() * 60 + now.getMinutes(), parseHM(settings.dndStart), parseHM(settings.dndEnd));
}


export interface TimeFormat {
  locale: string;
  hour12: boolean;
}

export type Translate = (key: string, params?: Record<string, string | number>) => string;

const hourOpts = (f: TimeFormat): Intl.DateTimeFormatOptions => ({
  hour: f.hour12 ? 'numeric' : '2-digit',
  minute: '2-digit',
  hourCycle: f.hour12 ? 'h12' : 'h23',
});

export function formatHM(hm: string, f: TimeFormat): string {
  const [h, m] = hm.split(':').map(Number);
  return new Intl.DateTimeFormat(f.locale, hourOpts(f)).format(new Date(2000, 0, 1, h, m));
}

export function formatDateTime(ts: number | null, f: TimeFormat): string {
  if (ts == null) return '—';
  return new Intl.DateTimeFormat(f.locale, { day: '2-digit', month: '2-digit', year: 'numeric', ...hourOpts(f) }).format(ts);
}

export function weekdayShort(day: number, f: TimeFormat): string {
  return new Intl.DateTimeFormat(f.locale, { weekday: 'short' }).format(new Date(2024, 0, 7 + day)).replace(/\.$/, '');
}

export function to12h(hm: string): { hour: number; minute: number; pm: boolean } {
  const [h, m] = hm.split(':').map(Number);
  return { hour: h % 12 || 12, minute: m, pm: h >= 12 };
}

export function from12h(hour: number, minute: number, pm: boolean): string {
  const h = (hour % 12) + (pm ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function fmtEvery(min: number, t: Translate): string {
  if (min < 60) return t('everyMin', { n: min });
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? t('everyHourMin', { h, m: r }) : t('everyHour', { n: h });
}

export function describeSchedule(s: Schedule, t: Translate, f: TimeFormat): string {
  if (s.mode === 'fixed') {
    const times = [...new Set(s.times)].sort().map((x) => formatHM(x, f)).join(', ') || t('schedNoTimes');
    const days =
      s.days.length && s.days.length < 7
        ? t('schedDays', { days: [...s.days].sort().map((d) => weekdayShort(d, f)).join(', ') })
        : t('schedAllDays');
    return t('schedFixed', { times, days });
  }
  const win =
    s.windowStart && s.windowEnd ? t('schedWindow', { start: formatHM(s.windowStart, f), end: formatHM(s.windowEnd, f) }) : '';
  return t('schedInterval', { every: fmtEvery(s.everyMinutes, t), window: win });
}
