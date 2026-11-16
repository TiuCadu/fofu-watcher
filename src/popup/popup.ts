import { applyI18n, errorText, loadI18n, type I18n } from '../utils/i18n';
import { getSites } from '../utils/storage';
import { formatDateTime } from '../utils/time';
import { clear, diffUrl, h, hostOf, statusInfo } from '../utils/ui';
import type { Site } from '../utils/types';

const list = document.getElementById('list')!;
const checking = new Set<string>();
let I: I18n;

function card(s: Site): HTMLElement {
  const { t, fmt } = I;
  const st = statusInfo(s, t);
  const btn = h('button', {
    class: 'small',
    disabled: checking.has(s.id),
    onclick: async () => {
      checking.add(s.id);
      void render();
      try { await chrome.runtime.sendMessage({ type: 'checkNow', id: s.id }); } finally { checking.delete(s.id); void render(); }
    },
  }, checking.has(s.id) ? t('checking') : t('checkNow'));

  return h('div', { class: 'card site' },
    h('div', { class: 'row' },
      h('div', { class: 'title spacer', title: s.url }, s.name || hostOf(s.url)),
      h('span', { class: `badge ${st.cls}` }, st.label)),
    h('div', { class: 'meta muted' },
      h('span', {}, t('lastLabel')), h('span', {}, formatDateTime(s.lastCheck, fmt)),
      h('span', {}, t('nextLabel')), h('span', {}, s.enabled ? formatDateTime(s.nextRun, fmt) : t('paused'))),
    s.status === 'error' && s.lastError ? h('div', { class: 'err' }, t('errorWithCount', { error: errorText(t, s.lastError), count: s.failures })) : null,
    h('div', { class: 'actions' },
      btn,
      s.history.length ? h('button', { class: 'small', onclick: () => chrome.tabs.create({ url: diffUrl(s.id) }) }, t('viewChanges')) : null),
  );
}

async function render(): Promise<void> {
  I = await loadI18n();
  applyI18n(I);
  const sites = await getSites();
  clear(list);
  if (!sites.length) {
    list.append(h('div', { class: 'empty' }, I.t('popupEmpty1'), h('br'), I.t('popupEmpty2')));
    return;
  }
  [...sites].sort((a, b) => Number(b.unseen) - Number(a.unseen)).forEach((s) => list.append(card(s)));
}

document.getElementById('btn-options')!.addEventListener('click', () => chrome.runtime.openOptionsPage());

document.getElementById('btn-add')!.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const base = chrome.runtime.getURL('options/options.html');
  if (!tab?.url || !/^https?:/.test(tab.url)) { await chrome.runtime.openOptionsPage(); return; }
  const q = new URLSearchParams({ add: tab.url, name: tab.title ?? '' });
  await chrome.tabs.create({ url: `${base}?${q}` });
  window.close();
});

chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && (c.sites || c.settings)) void render(); });
void render();
