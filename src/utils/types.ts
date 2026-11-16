
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
  lastError: ErrorInfo | string | null;
  baseText: string | null;
  baseHash: string | null;
  history: HistoryEntry[];
}

export interface ErrorInfo {
  key: string;
  params?: Record<string, string | number>;
}

export type LanguagePref = 'auto' | 'pt-BR' | 'en-US';
export type HourFormatPref = 'auto' | '12' | '24';

export interface Settings {
  language: LanguagePref;
  hourFormat: HourFormatPref;
  sound: boolean;
  dndEnabled: boolean;
  dndStart: string;
  dndEnd: string;
}

export const MAX_HISTORY = 50;
export const MAX_DIFF_LINES = 300;
export const FAILURES_BEFORE_ALERT = 3;

export interface PickerContext {
  strings: Record<string, string>;
  editId?: string;
}

export type BgMessage =
  | { type: 'checkNow'; id: string }
  | { type: 'checkDue' }
  | { type: 'testSelector'; url: string; selector: string; ignoreVolatile: boolean }
  | { type: 'pickerResult'; selector: string; preview: string; url: string; title: string; editId?: string };

export type CheckOutcome = 'baseline' | 'unchanged' | 'changed' | 'error';
export interface CheckResult {
  outcome: CheckOutcome;
  error?: ErrorInfo | string | null;
  info?: { chars: number; hash: string };
}
export type CheckNowResponse = { ok: true; result: CheckResult } | { ok: false; error: string };

export type TestSelectorResponse = { ok: true; text: string } | { ok: false; error: ErrorInfo };

export interface OffscreenRequest {
  target: 'offscreen';
  type: 'extract';
  html: string;
  selector: string;
  ignoreVolatile: boolean;
}

export type OffscreenResponse = { ok: true; text: string } | { ok: false; error: ErrorInfo };
