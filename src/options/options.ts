import { describeCheckResult, type CheckMessage } from '../utils/check-result';
import { applyI18n, errorText, loadI18n, type I18n } from '../utils/i18n';
import { deleteHistory, sitesWithHistory } from '../utils/history';
import { upsertSite } from '../utils/site-list';
import { hasHostPermission, originPattern } from '../utils/permissions';
import { launchPicker, waitTabComplete } from '../utils/picker-launch';
import { DEFAULT_SETTINGS, getSettings, getSites, mutateSites, saveSettings, updateSite } from '../utils/storage';
import { computeNextRun, describeSchedule, fixedTimes, formatDateTime, formatHM, isValidHM, weekdayShort } from '../utils/time';
import { mountTimePicker, type TimePicker } from '../utils/timepicker';
import { clear, h, hostOf, renderHistory, siteLink, statusInfo } from '../utils/ui';
import type { ErrorInfo, HourFormatPref, LanguagePref, ReadMode, Schedule, Settings, Site, TestSelectorResponse } from '../utils/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let I: I18n;
const t: I18n['t'] = (key, params) => I.t(key, params);

const pickers = new Map<string, { host: HTMLElement; p: TimePicker }>();
function mountPicker(id: string, value: string): void {
  const host = $(id);
  pickers.set(id, { host, p: mountTimePicker(host, value, I.hour12, t) });
}
const pv = (id: string) => pickers.get(id)!.p.get();
const remountPickers = () => { for (const [id, { p }] of pickers) mountPicker(id, p.get()); };

function showTab(name: string): void {
  for (const x of ['sites', 'history', 'settings']) $(`tab-${x}`).classList.toggle('hidden', x !== name);
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  if (name === 'history') void renderHistoryTab();
}
document.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab!)));

const checking = new Set<string>();
const results = new Map<string, CheckMessage>();

async function checkNow(id: string): Promise<void> {
  checking.add(id);
  results.delete(id);
  void renderSites();
  try {
    results.set(id, describeCheckResult(await chrome.runtime.sendMessage({ type: 'checkNow', id }), t));
  } catch (e) {
    results.set(id, { text: t('checkFailed', { error: String(e) }), isError: true });
  } finally { checking.delete(id); void renderSites(); }
}

async function renderSites(): Promise<void> {
  const sites = await getSites();
  const box = $('sites');
  const cards: HTMLElement[] = [];
  for (const s of sites) {
    const st = statusInfo(s, t);
    const permOk = await hasHostPermission(s.url).catch(() => false);
    cards.push(h('div', { class: `card site${s.enabled ? '' : ' paused'}` },
      h('div', { class: 'row' },
        h('span', { class: 'title' }, siteLink(s, t, s.name || hostOf(s.url))),
        h('span', { class: `badge ${st.cls}` }, st.label),
        s.unseen ? h('span', { class: 'badge changed' }, t('badgeNew')) : null),
      h('div', { class: 'muted url' }, siteLink(s, t, s.url), s.selector ? `  ·  ${s.selector}` : '', s.readMode === 'tab' ? `  ·  ${t('readModeTab')}` : '',
        s.readMode === 'tab' && s.clickBefore ? `  ·  ${t('readModeClick', { text: s.clickBefore })}` : ''),
      h('div', { class: 'grid muted' },
        h('span', {}, t('ruleLabel')), h('span', {}, describeSchedule(s.schedule, t, I.fmt)),
        h('span', {}, t('nextLabel')), h('span', {}, s.enabled ? formatDateTime(s.nextRun, I.fmt) : t('paused')),
        h('span', {}, t('lastLabel')), h('span', {}, formatDateTime(s.lastCheck, I.fmt))),
      s.lastError ? h('div', { class: 'error-text' }, t('siteErrorFails', { error: errorText(t, s.lastError), count: s.failures })) : null,
      !permOk ? h('div', { class: 'error-text' }, t('noPermission')) : null,
      results.has(s.id) ? h('div', { class: results.get(s.id)!.isError ? 'error-text' : 'muted', role: 'status' },
        results.get(s.id)!.text, results.get(s.id)!.detail ? h('div', {}, results.get(s.id)!.detail) : null) : null,
      h('div', { class: 'row wrap' },
        h('button', { class: 'small', disabled: checking.has(s.id), onclick: () => void checkNow(s.id) }, checking.has(s.id) ? t('checking') : t('checkNow')),
        h('button', { class: 'small', onclick: () => openForm(s) }, t('btnEdit')),
        h('button', { class: 'small', onclick: () => void toggle(s) }, s.enabled ? t('btnPause') : t('btnActivate')),
        h('button', { class: 'small danger', onclick: () => void remove(s) }, t('btnRemove'))),
    ));
  }
  clear(box);
  if (!cards.length) box.append(h('div', { class: 'empty card' }, t('noSites')));
  else box.append(...cards);
}

async function toggle(s: Site): Promise<void> {
  await updateSite(s.id, (x) => {
    x.enabled = !x.enabled;
    if (x.enabled) x.nextRun = Date.now();
  });
  if (!s.enabled) void chrome.runtime.sendMessage({ type: 'checkDue' });
}

async function remove(s: Site): Promise<void> {
  if (!confirm(t('confirmRemove', { name: s.name || s.url }))) return;
  const origin = originPattern(s.url);
  const rest = await mutateSites((sites) => {
    sites.splice(sites.findIndex((x) => x.id === s.id), 1);
    return sites.slice();
  });
  if (!rest.some((x) => originPattern(x.url) === origin)) await chrome.permissions.remove({ origins: [origin] }).catch(() => false);
}

const dlg = $<HTMLDialogElement>('dlg');
const form = $<HTMLFormElement>('form');
let editing: Site | null = null;
let draftId = '';
let times: string[] = [];
let timeTouched = false;

const daysBox = $('days');
const dayInputs = () => [...daysBox.querySelectorAll<HTMLInputElement>('input')];
function renderDays(checked: number[] = dayInputs().filter((i) => i.checked).map((i) => Number(i.dataset.d))): void {
  daysBox.querySelectorAll('label.day').forEach((l) => l.remove());
  for (let d = 0; d < 7; d++) {
    daysBox.append(h('label', { class: 'day' }, h('input', { type: 'checkbox', 'data-d': String(d), checked: checked.includes(d) }), weekdayShort(d, I.fmt)));
  }
}
const mode = () => (form.querySelector<HTMLInputElement>('input[name="mode"]:checked')!.value as 'fixed' | 'interval');

function renderChips(): void {
  const c = $('chips');
  clear(c);
  [...times].sort().forEach((x) => c.append(
    h('span', { class: 'chip' }, formatHM(x, I.fmt),
      h('button', { type: 'button', title: t('btnRemove'), onclick: () => { times = times.filter((y) => y !== x); renderChips(); updatePreview(); } }, '×')),
  ));
}

function readSchedule(): Schedule | { error: string } {
  if (mode() === 'fixed') {
    const all = fixedTimes(times, pv('f-time'), timeTouched);
    if (!all.length) return { error: 'errNeedTime' };
    return { mode: 'fixed', times: all, days: dayInputs().filter((i) => i.checked).map((i) => Number(i.dataset.d)) };
  }
  const every = Math.round(Number($<HTMLInputElement>('f-every').value) * Number($<HTMLSelectElement>('f-unit').value));
  if (!(every >= 1)) return { error: 'errInterval' };
  const useWin = $<HTMLInputElement>('f-window').checked;
  const ws = pv('f-ws'), we = pv('f-we');
  if (useWin && (!isValidHM(ws) || !isValidHM(we))) return { error: 'errWindow' };
  return { mode: 'interval', everyMinutes: every, windowStart: useWin ? ws : null, windowEnd: useWin ? we : null };
}

function updatePreview(): void {
  $('mode-fixed').classList.toggle('hidden', mode() !== 'fixed');
  $('mode-interval').classList.toggle('hidden', mode() !== 'interval');
  const s = readSchedule();
  $('preview').textContent = 'error' in s
    ? t(s.error)
    : t('previewNext', { rule: describeSchedule(s, t, I.fmt), next: formatDateTime(computeNextRun(s, new Date()), I.fmt) });
}

const setDlgTitle = () => { $('dlg-title').textContent = t(editing ? 'formEditTitle' : 'formAddTitle'); };

function openForm(site?: Site, preset?: { url?: string; name?: string; selector?: string; preview?: string }): void {
  editing = site ?? null;
  draftId = site?.id ?? crypto.randomUUID();
  setDlgTitle();
  $('form-error').textContent = '';
  $<HTMLInputElement>('f-url').value = site?.url ?? preset?.url ?? '';
  $<HTMLInputElement>('f-name').value = site?.name ?? preset?.name ?? '';
  $<HTMLInputElement>('f-selector').value = preset?.selector ?? site?.selector ?? '';
  showSelPreview(preset?.preview ? t('selPicked', { text: preset.preview.slice(0, 200) }) : '');
  updateSelectorUi();
  $<HTMLInputElement>('f-ignore').checked = site?.ignoreVolatile ?? true;
  $<HTMLInputElement>('f-tab').checked = site?.readMode === 'tab';
  $<HTMLInputElement>('f-click').value = site?.clickBefore ?? '';
  updateClickBox();

  const sc = site?.schedule;
  form.querySelector<HTMLInputElement>(`input[name="mode"][value="${sc?.mode ?? 'fixed'}"]`)!.checked = true;
  times = sc?.mode === 'fixed' ? [...sc.times] : [];
  timeTouched = false;
  renderDays(sc?.mode === 'fixed' ? sc.days : []);
  const every = sc?.mode === 'interval' ? sc.everyMinutes : 30;
  const hours = every >= 60 && every % 60 === 0;
  $<HTMLInputElement>('f-every').value = String(hours ? every / 60 : every);
  $<HTMLSelectElement>('f-unit').value = hours ? '60' : '1';
  $<HTMLInputElement>('f-window').checked = sc?.mode === 'interval' && !!sc.windowStart;
  pickers.get('f-time')!.p.set('09:00');
  pickers.get('f-ws')!.p.set((sc?.mode === 'interval' && sc.windowStart) || '08:00');
  pickers.get('f-we')!.p.set((sc?.mode === 'interval' && sc.windowEnd) || '20:00');
  renderChips();
  updatePreview();
  dlg.showModal();
}

form.addEventListener('input', updatePreview);
form.addEventListener('change', updatePreview);
$('btn-add-time').addEventListener('click', () => {
  const v = pv('f-time');
  if (isValidHM(v) && !times.includes(v)) times.push(v);
  timeTouched = false;
  renderChips(); updatePreview();
});
$('f-time').addEventListener('change', () => { timeTouched = true; });
$('btn-cancel').addEventListener('click', () => dlg.close());
dlg.addEventListener('close', () => void renderSites());
$('btn-new').addEventListener('click', () => openForm());

const selInput = () => $<HTMLInputElement>('f-selector');

function showSelPreview(text: string, bad = false): void {
  const box = $('sel-preview');
  box.textContent = text;
  box.classList.toggle('hidden', !text);
  box.classList.toggle('bad', bad);
}

function updateSelectorUi(): void {
  const sel = selInput().value.trim();
  const s = $('sel-summary');
  clear(s);
  if (sel) s.append(t('selUsing', { selector: '' }), h('span', { class: 'sel-code' }, sel));
  else s.append(t('selWhole'));
  $('btn-clear-sel').classList.toggle('hidden', !sel);
}
selInput().addEventListener('input', updateSelectorUi);
$('btn-clear-sel').addEventListener('click', () => { selInput().value = ''; showSelPreview(''); updateSelectorUi(); });

function readUrl(): string | null {
  let url = $<HTMLInputElement>('f-url').value.trim();
  if (url && !/^[a-z]+:\/\//i.test(url)) url = `https://${url}`;
  try { return /^https?:$/.test(new URL(url).protocol) ? url : null; } catch { return null; }
}

const askTest = (url: string): Promise<TestSelectorResponse> =>
  chrome.runtime.sendMessage({ type: 'testSelector', url, selector: selInput().value.trim(), ignoreVolatile: $<HTMLInputElement>('f-ignore').checked, readMode: readModeInput(), clickBefore: clickInput() });
const readModeInput = (): ReadMode => ($<HTMLInputElement>('f-tab').checked ? 'tab' : 'fetch');
const clickInput = (): string => (readModeInput() === 'tab' ? $<HTMLInputElement>('f-click').value.trim().slice(0, 80) : '');
function updateClickBox(): void { $('click-box').classList.toggle('hidden', readModeInput() !== 'tab'); }
$('f-tab').addEventListener('change', updateClickBox);
const testErrorText = (e: ErrorInfo | string) => (typeof e !== 'string' && e.key === 'errLoginRequired' && readModeInput() === 'fetch'
  ? t('errLoginRequiredHint', e.params ?? {})
  : t('selTestFail', { error: errorText(t, e) }));

$('btn-test-sel').addEventListener('click', async () => {
  const url = readUrl();
  if (!url) { $('form-error').textContent = t('errUrl'); return; }
  $('form-error').textContent = '';
  if (!(await chrome.permissions.request({ origins: [originPattern(url)] }))) { $('form-error').textContent = t('errPermDenied'); return; }
  showSelPreview(t('selTesting'));
  const r = await askTest(url);
  if (!r.ok) showSelPreview(testErrorText(r.error), true);
  else if (!r.text.trim()) showSelPreview(t(selInput().value.trim() ? 'selTestEmpty' : 'selTestEmptyPage'), true);
  else showSelPreview(t('selTestOk', { text: r.text.replace(/\s+/g, ' ').slice(0, 300) }));
});

$('btn-pick').addEventListener('click', async () => {
  const url = readUrl();
  if (!url) { $('form-error').textContent = t('errUrl'); return; }
  $('form-error').textContent = '';
  if (!(await chrome.permissions.request({ origins: [originPattern(url)] }))) { $('form-error').textContent = t('errPermDenied'); return; }
  showSelPreview(t('pickerOpening'));
  const tab = await chrome.tabs.create({ url, active: true });
  await waitTabComplete(tab.id!);
  if (!(await launchPicker(tab.id!, t, editing?.id))) showSelPreview(t('pickerUnavailable'), true);
});

let saving = false;
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (saving) return;
  saving = true;
  const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  btn.disabled = true;
  btn.textContent = t('saving');
  try { await saveForm(); } finally {
    saving = false;
    btn.disabled = false;
    btn.textContent = t('save');
  }
});

async function saveForm(): Promise<void> {
  const err = $('form-error');
  err.textContent = '';

  let url = $<HTMLInputElement>('f-url').value.trim();
  if (url && !/^[a-z]+:\/\//i.test(url)) url = `https://${url}`;
  try {
    if (!/^https?:$/.test(new URL(url).protocol)) throw new Error();
  } catch { err.textContent = t('errUrl'); return; }
  const selector = $<HTMLInputElement>('f-selector').value.trim();
  if (selector) { try { document.createDocumentFragment().querySelector(selector); } catch { err.textContent = t('errSelectorInvalid'); return; } }
  const schedule = readSchedule();
  if ('error' in schedule) { err.textContent = t(schedule.error); return; }

  const granted = await chrome.permissions.request({ origins: [originPattern(url)] });
  if (!granted) { err.textContent = t('errPermDenied'); return; }

  const name = $<HTMLInputElement>('f-name').value.trim();
  const ignoreVolatile = $<HTMLInputElement>('f-ignore').checked;
  const readMode = readModeInput();
  const clickBefore = clickInput();

  if (selector && (!editing || editing.url !== url || editing.selector !== selector || (editing.readMode ?? 'fetch') !== readMode
    || (editing.clickBefore ?? '') !== clickBefore)) {
    const r = await askTest(url);
    const problem = !r.ok ? errorText(t, r.error) : !r.text.trim() ? t('selTestEmpty') : null;
    if (problem && !confirm(t('warnSelector', { error: problem }))) return;
  }

  if (editing) {
    await updateSite(editing.id, (s) => {
      const rebase = s.url !== url || s.selector !== selector || s.ignoreVolatile !== ignoreVolatile || (s.readMode ?? 'fetch') !== readMode
        || (s.clickBefore ?? '') !== clickBefore;
      Object.assign(s, { url, name, selector, ignoreVolatile, readMode, clickBefore, schedule });
      if (rebase) Object.assign(s, { baseText: null, baseHash: null, status: 'pending', unseen: false, failures: 0, lastError: null, nextRun: Date.now() });
      else s.nextRun = computeNextRun(schedule, new Date());
    });
  } else {
    await mutateSites((sites) => {
      upsertSite(sites, {
        id: draftId, url, name, selector, ignoreVolatile, readMode, clickBefore, enabled: true, schedule,
        nextRun: Date.now(),
        lastCheck: null, status: 'pending', unseen: false, failures: 0, lastError: null,
        baseText: null, baseHash: null, history: [],
      });
    });
  }
  dlg.close();
  void chrome.runtime.sendMessage({ type: 'checkDue' });
}

const histSelected = new Set<number>();
let histShown: Site | undefined;

async function renderHistoryTab(): Promise<void> {
  const sites = sitesWithHistory(await getSites());
  const sel = $<HTMLSelectElement>('hist-site');
  const prev = sel.value;
  clear(sel);
  sites.forEach((s) => sel.append(h('option', { value: s.id }, s.name || hostOf(s.url))));
  if (prev && sites.some((s) => s.id === prev)) sel.value = prev;
  sel.classList.toggle('hidden', !sites.length);
  const site = sites.find((s) => s.id === sel.value);
  if (site?.id !== histShown?.id) histSelected.clear();
  for (const ts of [...histSelected]) if (!site?.history.some((e) => e.ts === ts)) histSelected.delete(ts);
  histShown = site;
  $('hist-tools').classList.toggle('hidden', !site);
  const box = $('hist');
  clear(box);
  box.append(site
    ? renderHistory(site, t, I.fmt, true, { selected: histSelected, onChange: updateHistTools })
    : h('div', { class: 'empty' }, t('historyNone')));
  updateHistTools();
}

function updateHistTools(): void {
  const total = histShown?.history.length ?? 0;
  const n = histSelected.size;
  const btn = $<HTMLButtonElement>('btn-hist-del-sel');
  btn.textContent = t('histDeleteSelected', { count: n });
  btn.disabled = n === 0;
  const all = $<HTMLInputElement>('hist-all');
  all.checked = total > 0 && n === total;
  all.indeterminate = n > 0 && n < total;
}

async function deleteHistoryOf(target: 'selected' | 'site' | 'all'): Promise<void> {
  const site = histShown;
  if (target !== 'all' && !site) return;
  const chosen = new Set(histSelected);
  if (target === 'selected' && !chosen.size) return;
  const question = target === 'selected' ? t('confirmHistDeleteSelected', { count: chosen.size })
    : target === 'site' ? t('confirmHistDeleteSite', { name: site!.name || hostOf(site!.url) })
    : t('confirmHistDeleteAll');
  if (!confirm(question)) return;
  await mutateSites((sites) => {
    for (const s of sites) {
      if (target === 'all') deleteHistory(s, 'all');
      else if (s.id === site!.id) deleteHistory(s, target === 'selected' ? chosen : 'all');
    }
  });
  histSelected.clear();
}

$<HTMLSelectElement>('hist-site').addEventListener('change', () => void renderHistoryTab());
$<HTMLInputElement>('hist-all').addEventListener('change', (e) => {
  histSelected.clear();
  if ((e.target as HTMLInputElement).checked) histShown?.history.forEach((x) => histSelected.add(x.ts));
  void renderHistoryTab();
});
$('btn-hist-del-sel').addEventListener('click', () => void deleteHistoryOf('selected'));
$('btn-hist-del-site').addEventListener('click', () => void deleteHistoryOf('site'));
$('btn-hist-del-all').addEventListener('click', () => void deleteHistoryOf('all'));

const msg = (text: string) => { $('settings-msg').textContent = text; };

async function loadSettings(): Promise<Settings> {
  const s = await getSettings();
  $<HTMLSelectElement>('s-lang').value = s.language;
  $<HTMLSelectElement>('s-hour').value = s.hourFormat;
  $<HTMLInputElement>('s-sound').checked = s.sound;
  $<HTMLInputElement>('s-dnd').checked = s.dndEnabled;
  return s;
}
async function persistSettings(): Promise<void> {
  const start = pv('s-dnd-start'), end = pv('s-dnd-end');
  await saveSettings({
    language: $<HTMLSelectElement>('s-lang').value as LanguagePref,
    hourFormat: $<HTMLSelectElement>('s-hour').value as HourFormatPref,
    sound: $<HTMLInputElement>('s-sound').checked,
    dndEnabled: $<HTMLInputElement>('s-dnd').checked,
    dndStart: isValidHM(start) ? start : DEFAULT_SETTINGS.dndStart,
    dndEnd: isValidHM(end) ? end : DEFAULT_SETTINGS.dndEnd,
  });
}
['s-lang', 's-hour', 's-sound', 's-dnd', 's-dnd-start', 's-dnd-end'].forEach((id) => $(id).addEventListener('change', () => void persistSettings()));

$('btn-export').addEventListener('click', async () => {
  const data = { app: 'fofu-watcher', version: 1, exportedAt: new Date().toISOString(), settings: await getSettings(), sites: await getSites() };
  const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: `fofu-watcher-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
  msg(t('msgExported'));
});

$('btn-import').addEventListener('click', () => $<HTMLInputElement>('file-import').click());
$<HTMLInputElement>('file-import').addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data?.app !== 'fofu-watcher' || !Array.isArray(data.sites)) throw new Error(t('msgImportBadFile'));
    const sites = data.sites.map(sanitizeSite).filter((s: Site | null): s is Site => s !== null);
    if (!confirm(t('confirmImport', { count: sites.length }))) return;
    await mutateSites((cur) => { cur.splice(0, cur.length, ...sites); });
    await saveSettings({ ...DEFAULT_SETTINGS, ...(data.settings as Partial<Settings>) });
    await syncSettingsControls();
    msg(t('msgImported', { count: sites.length }));
    void chrome.runtime.sendMessage({ type: 'checkDue' });
  } catch (e) {
    msg(t('msgImportFail', { error: (e as Error).message }));
  }
});

function sanitizeSite(raw: Partial<Site>): Site | null {
  try {
    if (!raw?.url || !/^https?:$/.test(new URL(raw.url).protocol)) return null;
    const sc = raw.schedule;
    let schedule: Schedule;
    if (sc?.mode === 'interval' && sc.everyMinutes >= 1) {
      const win = isValidHM(sc.windowStart) && isValidHM(sc.windowEnd);
      schedule = { mode: 'interval', everyMinutes: Math.round(sc.everyMinutes), windowStart: win ? sc.windowStart : null, windowEnd: win ? sc.windowEnd : null };
    } else if (sc?.mode === 'fixed' && Array.isArray(sc.times) && sc.times.some(isValidHM)) {
      schedule = { mode: 'fixed', times: sc.times.filter(isValidHM), days: (sc.days ?? []).filter((d) => d >= 0 && d <= 6) };
    } else return null;
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(),
      url: raw.url, name: String(raw.name ?? ''), selector: String(raw.selector ?? ''),
      ignoreVolatile: raw.ignoreVolatile !== false, readMode: raw.readMode === 'tab' ? 'tab' : 'fetch',
      clickBefore: raw.readMode === 'tab' ? String(raw.clickBefore ?? '').trim().slice(0, 80) : '', enabled: raw.enabled !== false, schedule,
      nextRun: Date.now(), lastCheck: raw.lastCheck ?? null,
      status: raw.baseHash ? 'ok' : 'pending', unseen: false, failures: 0, lastError: null,
      baseText: raw.baseText ?? null, baseHash: raw.baseHash ?? null,
      history: Array.isArray(raw.history) ? raw.history.slice(0, 50) : [],
    };
  } catch { return null; }
}

$('btn-grant').addEventListener('click', async () => {
  const origins = [...new Set((await getSites()).map((s) => originPattern(s.url)))];
  if (!origins.length) { msg(t('noSitesShort')); return; }
  const ok = await chrome.permissions.request({ origins });
  msg(t(ok ? 'msgGranted' : 'msgNotGranted'));
  void renderSites();
  if (ok) void chrome.runtime.sendMessage({ type: 'checkDue' });
});

function renderAbout(): void {
  $('about-version').textContent = t('aboutVersion', { version: chrome.runtime.getManifest().version });
}

async function refreshI18n(): Promise<void> {
  const prev = I;
  I = await loadI18n();
  applyI18n(I);
  renderAbout();
  if (prev && prev.lang === I.lang && prev.hour12 === I.hour12) return;
  remountPickers();
  renderDays();
  renderChips();
  setDlgTitle();
  updateSelectorUi();
  if (dlg.open) updatePreview();
  await renderSites();
  if (!$('tab-history').classList.contains('hidden')) await renderHistoryTab();
}

async function syncSettingsControls(): Promise<void> {
  const s = await loadSettings();
  pickers.get('s-dnd-start')!.p.set(s.dndStart);
  pickers.get('s-dnd-end')!.p.set(s.dndEnd);
}

chrome.storage.onChanged.addListener((c, area) => {
  if (area !== 'local') return;
  if (c.settings) void refreshI18n();
  if (c.sites) {
    if (!dlg.open) void renderSites();
    if (!$('tab-history').classList.contains('hidden')) void renderHistoryTab();
  }
});

void (async () => {
  I = await loadI18n();
  applyI18n(I);
  renderAbout();
  const s = await getSettings();
  for (const [id, v] of [['f-time', '09:00'], ['f-ws', '08:00'], ['f-we', '20:00'], ['s-dnd-start', s.dndStart], ['s-dnd-end', s.dndEnd]] as const) mountPicker(id, v);
  renderDays([]);
  await loadSettings();
  showTab('sites');
  await renderSites();
  const p = new URLSearchParams(location.search);
  const picked = { selector: p.get('selector') ?? undefined, preview: p.get('preview') ?? undefined };
  const editSite = p.get('edit') ? (await getSites()).find((x) => x.id === p.get('edit')) : undefined;
  if (editSite) openForm(editSite, picked);
  else if (p.get('add')) openForm(undefined, { url: p.get('add') ?? '', name: p.get('name') ?? '', ...picked });
  if (p.has('add') || p.has('edit')) history.replaceState(null, '', location.pathname);
})();
