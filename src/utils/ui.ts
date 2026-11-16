import { formatDateTime } from './time';
import type { DiffLine, HistoryEntry, Site } from './types';

type Child = Node | string | null | false | undefined;

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

export function renderDiff(lines: DiffLine[], omitted = 0): HTMLElement {
  const box = h('div', { class: 'diff' });
  for (const l of lines) box.append(h('div', { class: l.t }, (l.t === 'add' ? '+ ' : '− ') + l.line));
  if (omitted) box.append(h('div', { class: 'more' }, `… mais ${omitted} linha(s) não exibida(s)`));
  if (!lines.length) box.append(h('div', { class: 'more' }, 'Sem diferenças de texto registradas.'));
  return box;
}

export function renderHistory(site: Site, openFirst = false): HTMLElement {
  const box = h('div');
  if (!site.history.length) return h('div', { class: 'empty' }, 'Nenhuma mudança registrada ainda.');
  site.history.forEach((e: HistoryEntry, i) => {
    const add = e.diff.filter((d) => d.t === 'add').length;
    const del = e.diff.filter((d) => d.t === 'del').length;
    const d = h(
      'details',
      { class: 'entry', open: openFirst && i === 0 },
      h('summary', {}, formatDateTime(e.ts) + '  ', h('span', { class: 'plus' }, `+${add}`), ' ', h('span', { class: 'minus' }, `−${del}`)),
      renderDiff(e.diff, e.omitted),
    );
    box.append(d);
  });
  return box;
}

export function statusInfo(s: Site): { label: string; cls: string } {
  if (!s.enabled) return { label: 'Pausado', cls: 'paused' };
  switch (s.status) {
    case 'changed': return { label: 'Alterado', cls: 'changed' };
    case 'error': return { label: 'Erro', cls: 'error' };
    case 'pending': return { label: 'Aguardando 1ª verificação', cls: 'pending' };
    default: return { label: 'Sem mudança', cls: 'ok' };
  }
}

export const diffUrl = (id: string) => chrome.runtime.getURL(`diff/diff.html?site=${encodeURIComponent(id)}`);

export const hostOf = (url: string) => { try { return new URL(url).hostname; } catch { return url; } };
