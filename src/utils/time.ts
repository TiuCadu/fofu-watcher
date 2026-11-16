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

const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function fmtEvery(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function describeSchedule(s: Schedule): string {
  if (s.mode === 'fixed') {
    const times = [...new Set(s.times)].sort().join(', ') || '(sem horários)';
    const days = s.days.length && s.days.length < 7 ? ` — ${[...s.days].sort().map((d) => DAY_NAMES[d]).join(', ')}` : ' — todos os dias';
    return `Às ${times}${days}`;
  }
  const win = s.windowStart && s.windowEnd ? `, entre ${s.windowStart} e ${s.windowEnd}` : '';
  return `A cada ${fmtEvery(s.everyMinutes)}${win}`;
}

export const formatDateTime = (ts: number | null): string =>
  ts == null
    ? '—'
    : new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
