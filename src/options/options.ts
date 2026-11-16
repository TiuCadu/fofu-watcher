import { hasHostPermission, originPattern } from '../utils/permissions';
import { DEFAULT_SETTINGS, getSettings, getSites, mutateSites, saveSettings, updateSite } from '../utils/storage';
import { computeNextRun, describeSchedule, formatDateTime, isValidHM } from '../utils/time';
import { clear, h, hostOf, renderHistory, statusInfo } from '../utils/ui';
import type { Schedule, Settings, Site } from '../utils/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function showTab(name: string): void {
  for (const t of ['sites', 'history', 'settings']) $(`tab-${t}`).classList.toggle('hidden', t !== name);
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  if (name === 'history') void renderHistoryTab();
}
document.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab!)));

async function renderSites(): Promise<void> {
  const sites = await getSites();
  const box = $('sites');
  clear(box);
  if (!sites.length) {
    box.append(h('div', { class: 'empty card' }, 'Nenhum site cadastrado. Clique em “Adicionar site”.'));
    return;
  }
  for (const s of sites) {
    const st = statusInfo(s);
    const permOk = await hasHostPermission(s.url).catch(() => false);
    box.append(h('div', { class: `card site${s.enabled ? '' : ' paused'}` },
      h('div', { class: 'row' },
        h('span', { class: 'title' }, s.name || hostOf(s.url)),
        h('span', { class: `badge ${st.cls}` }, st.label),
        s.unseen ? h('span', { class: 'badge changed' }, 'novo') : null),
      h('div', { class: 'muted url' }, s.url + (s.selector ? `  ·  ${s.selector}` : '')),
      h('div', { class: 'grid muted' },
        h('span', {}, 'Regra:'), h('span', {}, describeSchedule(s.schedule)),
        h('span', {}, 'Próxima:'), h('span', {}, s.enabled ? formatDateTime(s.nextRun) : 'pausado'),
        h('span', {}, 'Última:'), h('span', {}, formatDateTime(s.lastCheck))),
      s.lastError ? h('div', { class: 'error-text' }, `${s.lastError} (${s.failures} falha(s) seguida(s))`) : null,
      !permOk ? h('div', { class: 'error-text' }, 'Sem permissão de acesso a este site. Edite e salve para conceder.') : null,
      h('div', { class: 'row wrap' },
        h('button', { class: 'small', onclick: () => void chrome.runtime.sendMessage({ type: 'checkNow', id: s.id }) }, 'Verificar agora'),
        h('button', { class: 'small', onclick: () => openForm(s) }, 'Editar'),
        h('button', { class: 'small', onclick: () => void toggle(s) }, s.enabled ? 'Pausar' : 'Ativar'),
        h('button', { class: 'small danger', onclick: () => void remove(s) }, 'Remover')),
    ));
  }
}

async function toggle(s: Site): Promise<void> {
  await updateSite(s.id, (x) => {
    x.enabled = !x.enabled;
    if (x.enabled) x.nextRun = Date.now(); 
  });
  if (!s.enabled) void chrome.runtime.sendMessage({ type: 'checkDue' });
}

async function remove(s: Site): Promise<void> {
  if (!confirm(`Remover “${s.name || s.url}” e todo o seu histórico?`)) return;
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
let times: string[] = [];

const daysBox = $('days');
DAY_LABELS.forEach((d, i) => daysBox.append(h('label', { class: 'day' }, h('input', { type: 'checkbox', 'data-d': String(i) }), d)));
const dayInputs = () => [...daysBox.querySelectorAll<HTMLInputElement>('input')];
const mode = () => (form.querySelector<HTMLInputElement>('input[name="mode"]:checked')!.value as 'fixed' | 'interval');

function renderChips(): void {
  const c = $('chips');
  clear(c);
  times.sort().forEach((t) => c.append(h('span', { class: 'chip' }, t, h('button', { type: 'button', title: 'Remover', onclick: () => { times = times.filter((x) => x !== t); renderChips(); updatePreview(); } }, '×'))));
}

function readSchedule(): Schedule | string {
  if (mode() === 'fixed') {
    if (!times.length) return 'Adicione ao menos um horário.';
    return { mode: 'fixed', times: [...times].sort(), days: dayInputs().filter((i) => i.checked).map((i) => Number(i.dataset.d)) };
  }
  const every = Math.round(Number($<HTMLInputElement>('f-every').value) * Number($<HTMLSelectElement>('f-unit').value));
  if (!(every >= 1)) return 'Informe um intervalo de pelo menos 1 minuto.';
  const useWin = $<HTMLInputElement>('f-window').checked;
  const ws = $<HTMLInputElement>('f-ws').value, we = $<HTMLInputElement>('f-we').value;
  if (useWin && (!isValidHM(ws) || !isValidHM(we))) return 'Informe a janela de horário completa.';
  return { mode: 'interval', everyMinutes: every, windowStart: useWin ? ws : null, windowEnd: useWin ? we : null };
}

function updatePreview(): void {
  $('mode-fixed').classList.toggle('hidden', mode() !== 'fixed');
  $('mode-interval').classList.toggle('hidden', mode() !== 'interval');
  const s = readSchedule();
  $('preview').textContent = typeof s === 'string' ? s : `${describeSchedule(s)}. Próxima verificação: ${formatDateTime(computeNextRun(s, new Date()))}`;
}

function openForm(site?: Site, preset?: { url?: string; name?: string }): void {
  editing = site ?? null;
  $('dlg-title').textContent = site ? 'Editar site' : 'Adicionar site';
  $('form-error').textContent = '';
  $<HTMLInputElement>('f-url').value = site?.url ?? preset?.url ?? '';
  $<HTMLInputElement>('f-name').value = site?.name ?? preset?.name ?? '';
  $<HTMLInputElement>('f-selector').value = site?.selector ?? '';
  $<HTMLInputElement>('f-ignore').checked = site?.ignoreVolatile ?? true;

  const sc = site?.schedule;
  form.querySelector<HTMLInputElement>(`input[name="mode"][value="${sc?.mode ?? 'fixed'}"]`)!.checked = true;
  times = sc?.mode === 'fixed' ? [...sc.times] : [];
  dayInputs().forEach((i) => (i.checked = sc?.mode === 'fixed' && sc.days.includes(Number(i.dataset.d))));
  const every = sc?.mode === 'interval' ? sc.everyMinutes : 30;
  const hours = every >= 60 && every % 60 === 0;
  $<HTMLInputElement>('f-every').value = String(hours ? every / 60 : every);
  $<HTMLSelectElement>('f-unit').value = hours ? '60' : '1';
  $<HTMLInputElement>('f-window').checked = sc?.mode === 'interval' && !!sc.windowStart;
  $<HTMLInputElement>('f-ws').value = (sc?.mode === 'interval' && sc.windowStart) || '08:00';
  $<HTMLInputElement>('f-we').value = (sc?.mode === 'interval' && sc.windowEnd) || '20:00';
  renderChips();
  updatePreview();
  dlg.showModal();
}

form.addEventListener('input', updatePreview);
form.addEventListener('change', updatePreview);
$('btn-add-time').addEventListener('click', () => {
  const v = $<HTMLInputElement>('f-time').value;
  if (isValidHM(v) && !times.includes(v)) { times.push(v); renderChips(); updatePreview(); }
});
$('btn-cancel').addEventListener('click', () => dlg.close());
$('btn-new').addEventListener('click', () => openForm());

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const err = $('form-error');
  err.textContent = '';

  let url = $<HTMLInputElement>('f-url').value.trim();
  if (url && !/^[a-z]+:\/\//i.test(url)) url = `https://${url}`;
  try {
    if (!/^https?:$/.test(new URL(url).protocol)) throw new Error();
  } catch { err.textContent = 'Informe uma URL válida (http ou https).'; return; }
  const selector = $<HTMLInputElement>('f-selector').value.trim();
  if (selector) { try { document.createDocumentFragment().querySelector(selector); } catch { err.textContent = 'Seletor CSS inválido.'; return; } }
  const schedule = readSchedule();
  if (typeof schedule === 'string') { err.textContent = schedule; return; }

  const granted = await chrome.permissions.request({ origins: [originPattern(url)] });
  if (!granted) { err.textContent = 'Sem a permissão de acesso ao site não é possível monitorá-lo.'; return; }

  const name = $<HTMLInputElement>('f-name').value.trim();
  const ignoreVolatile = $<HTMLInputElement>('f-ignore').checked;

  if (editing) {
    await updateSite(editing.id, (s) => {
      const rebase = s.url !== url || s.selector !== selector || s.ignoreVolatile !== ignoreVolatile;
      Object.assign(s, { url, name, selector, ignoreVolatile, schedule });
      if (rebase) Object.assign(s, { baseText: null, baseHash: null, status: 'pending', unseen: false, failures: 0, lastError: null, nextRun: Date.now() });
      else s.nextRun = computeNextRun(schedule, new Date());
    });
  } else {
    await mutateSites((sites) => {
      sites.push({
        id: crypto.randomUUID(), url, name, selector, ignoreVolatile, enabled: true, schedule,
        nextRun: Date.now(), 
        lastCheck: null, status: 'pending', unseen: false, failures: 0, lastError: null,
        baseText: null, baseHash: null, history: [],
      });
    });
  }
  dlg.close();
  void chrome.runtime.sendMessage({ type: 'checkDue' });
});

async function renderHistoryTab(): Promise<void> {
  const sites = await getSites();
  const sel = $<HTMLSelectElement>('hist-site');
  const prev = sel.value;
  clear(sel);
  sites.forEach((s) => sel.append(h('option', { value: s.id }, s.name || hostOf(s.url))));
  if (prev && sites.some((s) => s.id === prev)) sel.value = prev;
  const site = sites.find((s) => s.id === sel.value);
  const box = $('hist');
  clear(box);
  box.append(site ? renderHistory(site, true) : h('div', { class: 'empty' }, 'Nenhum site cadastrado.'));
}
$<HTMLSelectElement>('hist-site').addEventListener('change', () => void renderHistoryTab());

const msg = (t: string) => { $('settings-msg').textContent = t; };

async function loadSettings(): Promise<void> {
  const s = await getSettings();
  $<HTMLInputElement>('s-sound').checked = s.sound;
  $<HTMLInputElement>('s-dnd').checked = s.dndEnabled;
  $<HTMLInputElement>('s-dnd-start').value = s.dndStart;
  $<HTMLInputElement>('s-dnd-end').value = s.dndEnd;
}
async function persistSettings(): Promise<void> {
  const start = $<HTMLInputElement>('s-dnd-start').value, end = $<HTMLInputElement>('s-dnd-end').value;
  await saveSettings({
    sound: $<HTMLInputElement>('s-sound').checked,
    dndEnabled: $<HTMLInputElement>('s-dnd').checked,
    dndStart: isValidHM(start) ? start : DEFAULT_SETTINGS.dndStart,
    dndEnd: isValidHM(end) ? end : DEFAULT_SETTINGS.dndEnd,
  });
}
['s-sound', 's-dnd', 's-dnd-start', 's-dnd-end'].forEach((id) => $(id).addEventListener('change', () => void persistSettings()));

$('btn-export').addEventListener('click', async () => {
  const data = { app: 'fofu-watcher', version: 1, exportedAt: new Date().toISOString(), settings: await getSettings(), sites: await getSites() };
  const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: `fofu-watcher-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
  msg('Configurações exportadas.');
});

$('btn-import').addEventListener('click', () => $<HTMLInputElement>('file-import').click());
$<HTMLInputElement>('file-import').addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data?.app !== 'fofu-watcher' || !Array.isArray(data.sites)) throw new Error('Arquivo não é um backup do Fofu Watcher.');
    const sites = data.sites.map(sanitizeSite).filter((s: Site | null): s is Site => s !== null);
    if (!confirm(`Importar ${sites.length} site(s)? Isso substitui os sites e configurações atuais.`)) return;
    await mutateSites((cur) => { cur.splice(0, cur.length, ...sites); });
    await saveSettings({ ...DEFAULT_SETTINGS, ...(data.settings as Partial<Settings>) });
    await loadSettings();
    msg(`${sites.length} site(s) importado(s). Clique em “Conceder permissões dos sites” para liberar o acesso.`);
    void chrome.runtime.sendMessage({ type: 'checkDue' });
  } catch (e) {
    msg(`Falha ao importar: ${(e as Error).message}`);
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
      ignoreVolatile: raw.ignoreVolatile !== false, enabled: raw.enabled !== false, schedule,
      nextRun: Date.now(), lastCheck: raw.lastCheck ?? null,
      status: raw.baseHash ? 'ok' : 'pending', unseen: false, failures: 0, lastError: null,
      baseText: raw.baseText ?? null, baseHash: raw.baseHash ?? null,
      history: Array.isArray(raw.history) ? raw.history.slice(0, 50) : [],
    };
  } catch { return null; }
}

$('btn-grant').addEventListener('click', async () => {
  const origins = [...new Set((await getSites()).map((s) => originPattern(s.url)))];
  if (!origins.length) { msg('Nenhum site cadastrado.'); return; }
  const ok = await chrome.permissions.request({ origins });
  msg(ok ? 'Permissões concedidas.' : 'Permissões não concedidas.');
  void renderSites();
  if (ok) void chrome.runtime.sendMessage({ type: 'checkDue' });
});

chrome.storage.onChanged.addListener((c, area) => {
  if (area !== 'local') return;
  if (c.sites) { if (!dlg.open) void renderSites(); if (!$('tab-history').classList.contains('hidden')) void renderHistoryTab(); }
});

void (async () => {
  await loadSettings();
  showTab('sites');
  await renderSites();
  const p = new URLSearchParams(location.search);
  if (p.get('add')) {
    openForm(undefined, { url: p.get('add') ?? '', name: p.get('name') ?? '' });
    history.replaceState(null, '', location.pathname);
  }
})();
