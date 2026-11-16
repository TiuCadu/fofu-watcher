
export interface FixedSchedule {
  mode: 'fixed';
  times: string[];
  days: number[];
}

export interface IntervalSchedule {
  mode: 'interval';
  everyMinutes: number;
  windowStart: string | null;
  windowEnd: string | null;
}

export type Schedule = FixedSchedule | IntervalSchedule;

export type SiteStatus = 'pending' | 'ok' | 'changed' | 'error';

export interface DiffLine {
  t: 'add' | 'del';
  line: string;
}

export interface HistoryEntry {
  ts: number;
  diff: DiffLine[];
  omitted: number;
}

export interface Site {
  id: string;
  url: string;
  name: string;
  selector: string;
  ignoreVolatile: boolean;
  enabled: boolean;
  schedule: Schedule;
  nextRun: number | null;
  lastCheck: number | null;
  status: SiteStatus;
  unseen: boolean;
  failures: number;
  lastError: string | null;
  baseText: string | null;
  baseHash: string | null;
  history: HistoryEntry[];
}

export interface Settings {
  sound: boolean;
  dndEnabled: boolean;
  dndStart: string;
  dndEnd: string;
}

export const MAX_HISTORY = 50;
export const MAX_DIFF_LINES = 300;
export const FAILURES_BEFORE_ALERT = 3;

export type BgMessage =
  | { type: 'checkNow'; id: string }
  | { type: 'checkDue' };

export interface OffscreenRequest {
  target: 'offscreen';
  type: 'extract';
  html: string;
  selector: string;
  ignoreVolatile: boolean;
}

export type OffscreenResponse = { ok: true; text: string } | { ok: false; error: string };
