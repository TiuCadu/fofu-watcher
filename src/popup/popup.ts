import { describeCheckResult, type CheckMessage } from '../utils/check-result';
import { applyI18n, errorText, loadI18n, type I18n } from '../utils/i18n';
import { openOptionsTab } from '../utils/options-tab';
import { launchPicker } from '../utils/picker-launch';
import { getSites } from '../utils/storage';
import { formatDateTime } from '../utils/time';
import { clear, diffUrl, h, hostOf, siteLink, statusInfo } from '../utils/ui';
import { isHttpUrl } from '../utils/url';
import type { Site } from '../utils/types';

const list = document.getElementById('list')!;
const checking = new Set<string>();
const results = new Map<string, CheckMessage>();
let I: I18n;

function card(s: Site): HTMLElement {
  const { t, fmt } = I;
  const st = statusInfo(s, t);
  const btn = h('button', {
    class: 'small',
    disabled: checking.has(s.id),
    onclick: async () => {
      checking.add(s.id);
      results.delete(s.id);
      void render();
      try {
        results.set(s.id, describeCheckResult(await chrome.runtime.sendMessage({ type: 'checkNow', id: s.id }), I.t));
      } catch (e) {
        results.set(s.id, { text: I.t('checkFailed', { error: String(e) }), isError: true });
      } finally { checking.delete(s.id); void render(); }
    },
  }, checking.has(s.id) ? t('checking') : t('checkNow'));
  const res = results.get(s.id);

  return h('div', { class: 'card site' },
    h('div', { class: 'row' },
      h('div', { class: 'title spacer' }, siteLink(s, t, s.name || hostOf(s.url))),
      h('span', { class: `badge ${st.cls}` }, st.label)),
    h('div', { class: 'meta muted' },
      h('span', {}, t('lastLabel')), h('span', {}, formatDateTime(s.lastCheck, fmt)),
      h('span', {}, t('nextLabel')), h('span', {}, s.enabled ? formatDateTime(s.nextRun, fmt) : t('paused'))),
    s.status === 'error' && s.lastError ? h('div', { class: 'err' }, t('errorWithCount', { error: errorText(t, s.lastError), count: s.failures })) : null,
    res ? h('div', { class: `result${res.isError ? ' err' : ''}`, role: 'status' }, res.text,
      res.detail ? h('div', { class: 'muted' }, res.detail) : null) : null,
    h('div', { class: 'actions' },
      btn,
      isHttpUrl(s.url) ? h('button', { class: 'small', title: t('openSiteTitle', { url: s.url }), onclick: () => chrome.tabs.create({ url: s.url }) }, `${t('openSite')} ↗`) : null,
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
  if (!tab?.url || !/^https?:/.test(tab.url)) { await chrome.runtime.openOptionsPage(); return; }
  await openOptionsTab(new URLSearchParams({ add: tab.url, name: tab.title ?? '' }));
  window.close();
});

document.getElementById('btn-pick')!.addEventListener('click', async () => {
  const msg = document.getElementById('msg')!;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const ok = tab?.id != null && /^https?:/.test(tab.url ?? '') && (await launchPicker(tab.id, I.t));
  if (ok) { window.close(); return; }
  msg.textContent = I.t('pickerUnavailable');
  msg.classList.remove('hidden');
});

chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && (c.sites || c.settings)) void render(); });
void render();
