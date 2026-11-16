import { getSettings } from './storage';
import type { TimeFormat, Translate } from './time';
import type { ErrorInfo, HourFormatPref, LanguagePref } from './types';

export type Lang = 'pt-BR' | 'en-US';
export type Params = Record<string, string | number>;
export type Messages = Record<string, { message: string }>;

export const LANGS: Lang[] = ['pt-BR', 'en-US'];
export const FALLBACK_LANG: Lang = 'pt-BR';

export const localeDir = (l: Lang): string => l.replace('-', '_');

export function resolveLanguage(pref: LanguagePref, browserLang: string): Lang {
  if (pref !== 'auto') return pref;
  return browserLang.toLowerCase().startsWith('en') ? 'en-US' : FALLBACK_LANG;
}

export function resolveHour12(pref: HourFormatPref, lang: Lang): boolean {
  return pref === 'auto' ? lang === 'en-US' : pref === '12';
}

export function interpolate(msg: string, params?: Params): string {
  return params ? msg.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : msg;
}

export function makeTranslator(messages: Messages): Translate {
  return (key, params) => interpolate(messages[key]?.message ?? key, params);
}

export function errorText(t: Translate, e: ErrorInfo | string | null | undefined): string {
  if (!e) return '';
  return typeof e === 'string' ? e : t(e.key, e.params);
}

export interface I18n {
  lang: Lang;
  hour12: boolean;
  t: Translate;
  fmt: TimeFormat;
}

const cache = new Map<Lang, Messages>();

async function loadMessages(lang: Lang): Promise<Messages> {
  let m = cache.get(lang);
  if (!m) {
    const res = await fetch(chrome.runtime.getURL(`_locales/${localeDir(lang)}/messages.json`));
    m = (await res.json()) as Messages;
    cache.set(lang, m);
  }
  return m;
}

export async function loadI18n(): Promise<I18n> {
  const s = await getSettings();
  const lang = resolveLanguage(s.language, chrome.i18n.getUILanguage());
  const hour12 = resolveHour12(s.hourFormat, lang);
  return { lang, hour12, t: makeTranslator(await loadMessages(lang)), fmt: { locale: lang, hour12 } };
}

export function applyI18n(i: I18n, root: ParentNode = document): void {
  document.documentElement.lang = i.lang;
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((e) => { e.textContent = i.t(e.dataset.i18n!); });
  for (const attr of ['placeholder', 'title', 'aria-label']) {
    root.querySelectorAll<HTMLElement>(`[data-i18n-${attr}]`).forEach((e) => e.setAttribute(attr, i.t(e.getAttribute(`data-i18n-${attr}`)!)));
  }
}
