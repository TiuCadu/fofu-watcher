import { diffLines } from '../utils/diff';
import { errorText, loadI18n } from '../utils/i18n';
import { sha256Hex } from '../utils/hash';
import { isLoginRedirect, readRenderedText, shortUrl, TAB_LOAD_TIMEOUT_MS, TAB_SETTLE_MS, type RenderedRead } from '../utils/page-reader';
import { waitTabComplete } from '../utils/picker-launch';
import { singleFlight } from '../utils/single-flight';
import { normalizeText } from '../utils/normalize';
import { hasHostPermission } from '../utils/permissions';
import { getSettings, getSite, updateSite } from '../utils/storage';
import { computeNextRun, isDnd } from '../utils/time';
import {
  FAILURES_BEFORE_ALERT, MAX_DIFF_LINES, MAX_HISTORY,
  type CheckResult, type ErrorInfo, type OffscreenRequest, type OffscreenResponse, type ReadMode, type Site, type TestSelectorResponse,
} from '../utils/types';

const FETCH_TIMEOUT_MS = 30_000;

class CheckError extends Error {
  constructor(public info: ErrorInfo) { super(info.key); }
}

async function fetchHtml(site: Pick<Site, 'url'>): Promise<string> {
  if (!(await hasHostPermission(site.url))) throw new CheckError({ key: 'errNoPermission' });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(site.url, { credentials: 'include', signal: ctrl.signal, cache: 'no-store' });
    if (r.redirected && isLoginRedirect(site.url, r.url)) throw new CheckError({ key: 'errLoginRequired', params: { url: shortUrl(r.url) } });
    if (!r.ok) throw new CheckError({ key: 'errHttp', params: { status: r.status } });
    return await r.text();
  } catch (e) {
    if (e instanceof CheckError) throw e;
    if ((e as Error).name === 'AbortError') throw new CheckError({ key: 'errTimeout', params: { seconds: FETCH_TIMEOUT_MS / 1000 } });
    throw new CheckError({ key: 'errNetwork' });
  } finally {
    clearTimeout(timer);
  }
}

let creating: Promise<void> | null = null;
async function ensureOffscreen(): Promise<void> {
  const ctxs = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType] });
  if (ctxs.length) return;
  creating ??= chrome.offscreen
    .createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['DOM_PARSER' as chrome.offscreen.Reason],
      justification: 'Analisar o HTML dos sites monitorados (DOMParser) e aplicar o seletor CSS.',
    })
    .finally(() => { creating = null; });
  await creating;
}

async function extractText(html: string, site: Pick<Site, 'selector' | 'ignoreVolatile'>): Promise<string> {
  await ensureOffscreen();
  const req: OffscreenRequest = { target: 'offscreen', type: 'extract', html, selector: site.selector, ignoreVolatile: site.ignoreVolatile };
  const res = (await chrome.runtime.sendMessage(req)) as OffscreenResponse | undefined;
  if (!res) throw new CheckError({ key: 'errNoAnswer' });
  if (!res.ok) throw new CheckError(res.error);
  return normalizeText(res.text, site.ignoreVolatile);
}

async function readViaTab(site: Pick<Site, 'url' | 'selector' | 'clickBefore'>): Promise<string> {
  if (!(await hasHostPermission(site.url))) throw new CheckError({ key: 'errNoPermission' });
  const win = await chrome.windows.create({ url: site.url, focused: false, state: 'minimized' })
    .catch(() => chrome.windows.create({ url: site.url, focused: false }));
  try {
    const tabId = win?.tabs?.[0]?.id;
    if (tabId == null) throw new CheckError({ key: 'errTabRead', params: { message: 'no tab' } });
    await waitTabComplete(tabId, TAB_LOAD_TIMEOUT_MS);
    let res: RenderedRead | undefined;
    try {
      [{ result: res }] = await chrome.scripting.executeScript({ target: { tabId }, func: readRenderedText, args: [site.selector, TAB_SETTLE_MS, 700, site.clickBefore ?? ''] });
    } catch (e) {
      const final = (await chrome.tabs.get(tabId).catch(() => undefined))?.url;
      if (final && isLoginRedirect(site.url, final)) throw new CheckError({ key: 'errLoginRequired', params: { url: shortUrl(final) } });
      throw new CheckError({ key: 'errTabRead', params: { message: (e as Error).message } });
    }
    if (!res) throw new CheckError({ key: 'errNoAnswer' });
    if (isLoginRedirect(site.url, res.url)) throw new CheckError({ key: 'errLoginRequired', params: { url: shortUrl(res.url) } });
    if (!res.ok) throw new CheckError({ key: res.key });
    return res.text;
  } finally {
    if (win?.id != null) await chrome.windows.remove(win.id).catch(() => undefined);
  }
}

async function readSite(site: Pick<Site, 'url' | 'selector' | 'ignoreVolatile' | 'readMode' | 'clickBefore'>): Promise<string> {
  if (site.readMode === 'tab') return normalizeText(await readViaTab(site), site.ignoreVolatile);
  return extractText(await fetchHtml(site), site);
}

export async function testSelector(url: string, selector: string, ignoreVolatile: boolean, readMode: ReadMode = 'fetch', clickBefore = ''): Promise<TestSelectorResponse> {
  try {
    const text = await readSite({ url, selector, ignoreVolatile, readMode, clickBefore });
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e instanceof CheckError ? e.info : { key: 'errUnexpected', params: { message: (e as Error).message } } };
  }
}

async function notify(site: Site, kind: 'changed' | 'error'): Promise<void> {
  const settings = await getSettings();
  if (isDnd(settings, new Date())) return;
  const { t } = await loadI18n();
  const changed = kind === 'changed';
  const name = site.name || site.url;
  await chrome.notifications.create(`fofu:${site.id}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: t(changed ? 'notifChangedTitle' : 'notifErrorTitle'),
    message: changed
      ? t('notifChangedMsg', { name })
      : t('notifErrorMsg', { name, count: FAILURES_BEFORE_ALERT, error: errorText(t, site.lastError) }),
    buttons: changed ? [{ title: t('viewChanges') }] : undefined,
    silent: !settings.sound,
    requireInteraction: false,
  });
}

const checkOnce = singleFlight(runCheck);
export const checkSite = (id: string, manual = false): Promise<CheckResult> => checkOnce(id, manual);

async function runCheck(id: string, manual: boolean): Promise<CheckResult> {
  const site = await getSite(id);
  if (!site) return { outcome: 'error', error: { key: 'errUnexpected', params: { message: 'site not found' } } };

  let newText: string | null = null;
  let newHash: string | null = null;
  let error: ErrorInfo | null = null;
  try {
    newText = await readSite(site);
    newHash = await sha256Hex(newText);
  } catch (e) {
    error = e instanceof CheckError ? e.info : { key: 'errUnexpected', params: { message: (e as Error).message } };
  }

  let changed = false;
  let failureAlert = false;
  let firstRun = false;
  const updated = await updateSite(id, (s) => {
    const now = Date.now();
    s.lastCheck = now;
    if (!manual || s.nextRun == null || s.nextRun <= now) s.nextRun = computeNextRun(s.schedule, new Date(now));

    if (error !== null) {
      s.failures += 1;
      s.lastError = error;
      s.status = 'error';
      failureAlert = s.failures === FAILURES_BEFORE_ALERT;
      return;
    }

    s.failures = 0;
    s.lastError = null;
    if (s.baseHash === null || s.baseText === null) {
      s.baseText = newText;
      s.baseHash = newHash;
      s.status = 'ok';
      firstRun = true;
    } else if (s.baseHash !== newHash) {
      const diff = diffLines(s.baseText.split('\n'), newText!.split('\n'));
      s.history.unshift({ ts: now, diff: diff.slice(0, MAX_DIFF_LINES), omitted: Math.max(0, diff.length - MAX_DIFF_LINES) });
      s.history.length = Math.min(s.history.length, MAX_HISTORY);
      s.baseText = newText;
      s.baseHash = newHash;
      s.status = 'changed';
      s.unseen = true;
      changed = true;
    } else {
      s.status = s.unseen ? 'changed' : 'ok';
    }
  });

  if (!updated) return { outcome: 'error', error: { key: 'errUnexpected', params: { message: 'site removed' } } };
  const logNotifyError = (e: unknown) => console.error('[Fofu] falha ao notificar', e);
  if (changed) await notify(updated, 'changed').catch(logNotifyError);
  else if (failureAlert) await notify(updated, 'error').catch(logNotifyError);
  if (error !== null) return { outcome: 'error', error };
  return {
    outcome: changed ? 'changed' : firstRun ? 'baseline' : 'unchanged',
    info: { chars: newText?.length ?? 0, hash: (newHash ?? '').slice(0, 8) },
  };
}
