import { formatDateTime, type TimeFormat, type Translate } from './time';
import type { DiffLine, HistoryEntry, Site } from './types';
import { isHttpUrl } from './url';

type Child = Node | string | null | false | undefined;

export function siteLink(site: Site, t: Translate, text: string): Node | string {
  if (!isHttpUrl(site.url)) return text;
  const a = document.createElement('a');
  a.href = site.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.title = t('openSiteTitle', { url: site.url });
  a.className = 'site-link';
  a.textContent = text;
  return a;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k in el) (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

export const clear = (el: Element) => el.replaceChildren();

export function renderDiff(lines: DiffLine[], omitted: number, t: Translate): HTMLElement {
  const box = h('div', { class: 'diff' });
  for (const l of lines) box.append(h('div', { class: l.t }, (l.t === 'add' ? '+ ' : '− ') + l.line));
  if (omitted) box.append(h('div', { class: 'more' }, t('diffMore', { count: omitted })));
  if (!lines.length) box.append(h('div', { class: 'more' }, t('diffEmpty')));
  return box;
}

export function renderHistory(site: Site, t: Translate, fmt: TimeFormat, openFirst = false): HTMLElement {
  const box = h('div');
  if (!site.history.length) return h('div', { class: 'empty' }, t('noHistory'));
  site.history.forEach((e: HistoryEntry, i) => {
    const add = e.diff.filter((d) => d.t === 'add').length;
    const del = e.diff.filter((d) => d.t === 'del').length;
    const d = h(
      'details',
      { class: 'entry', open: openFirst && i === 0 },
      h('summary', {}, formatDateTime(e.ts, fmt) + '  ', h('span', { class: 'plus' }, `+${add}`), ' ', h('span', { class: 'minus' }, `−${del}`)),
      renderDiff(e.diff, e.omitted, t),
    );
    box.append(d);
  });
  return box;
}

export function statusInfo(s: Site, t: Translate): { label: string; cls: string } {
  if (!s.enabled) return { label: t('statusPaused'), cls: 'paused' };
  switch (s.status) {
    case 'changed': return { label: t('statusChanged'), cls: 'changed' };
    case 'error': return { label: t('statusError'), cls: 'error' };
    case 'pending': return { label: t('statusPending'), cls: 'pending' };
    default: return { label: t('statusOk'), cls: 'ok' };
  }
}

export const diffUrl = (id: string) => chrome.runtime.getURL(`diff/diff.html?site=${encodeURIComponent(id)}`);

export const hostOf = (url: string) => { try { return new URL(url).hostname; } catch { return url; } };
