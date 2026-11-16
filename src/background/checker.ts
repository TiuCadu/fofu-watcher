import { diffLines } from '../utils/diff';
import { sha256Hex } from '../utils/hash';
import { normalizeText } from '../utils/normalize';
import { hasHostPermission } from '../utils/permissions';
import { getSettings, getSite, updateSite } from '../utils/storage';
import { computeNextRun, isDnd } from '../utils/time';
import {
  FAILURES_BEFORE_ALERT, MAX_DIFF_LINES, MAX_HISTORY,
  type OffscreenRequest, type OffscreenResponse, type Site,
} from '../utils/types';

const FETCH_TIMEOUT_MS = 30_000;

class CheckError extends Error {}

async function fetchHtml(site: Site): Promise<string> {
  if (!(await hasHostPermission(site.url))) throw new CheckError('Sem permissão para este site (edite o site e conceda o acesso)');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(site.url, { credentials: 'include', signal: ctrl.signal, cache: 'no-store' });
    if (!r.ok) throw new CheckError(`HTTP ${r.status}`);
    return await r.text();
  } catch (e) {
    if (e instanceof CheckError) throw e;
    if ((e as Error).name === 'AbortError') throw new CheckError('Tempo esgotado (30 s)');
    throw new CheckError('Falha de rede: site fora do ar ou sem conexão');
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

async function extractText(html: string, site: Site): Promise<string> {
  await ensureOffscreen();
  const req: OffscreenRequest = { target: 'offscreen', type: 'extract', html, selector: site.selector, ignoreVolatile: site.ignoreVolatile };
  const res = (await chrome.runtime.sendMessage(req)) as OffscreenResponse | undefined;
  if (!res) throw new CheckError('Sem resposta do analisador de página');
  if (!res.ok) throw new CheckError(res.error);
  return normalizeText(res.text, site.ignoreVolatile);
}

async function notify(site: Site, kind: 'changed' | 'error'): Promise<void> {
  const settings = await getSettings();
  if (isDnd(settings, new Date())) return; 
  const changed = kind === 'changed';
  await chrome.notifications.create(`fofu:${site.id}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: changed ? 'Fofu Watcher: site alterado' : 'Fofu Watcher: falha repetida',
    message: changed
      ? `${site.name || site.url} mudou.`
      : `${site.name || site.url} falhou ${FAILURES_BEFORE_ALERT} vezes seguidas: ${site.lastError ?? 'erro'}`,
    buttons: changed ? [{ title: 'Ver mudanças' }] : undefined,
    silent: !settings.sound,
    requireInteraction: false,
  });
}

export async function checkSite(id: string, manual = false): Promise<void> {
  const site = await getSite(id);
  if (!site) return;

  let newText: string | null = null;
  let newHash: string | null = null;
  let error: string | null = null;
  try {
    newText = await extractText(await fetchHtml(site), site);
    newHash = await sha256Hex(newText);
  } catch (e) {
    error = e instanceof CheckError ? e.message : `Erro inesperado: ${(e as Error).message}`;
  }

  let changed = false;
  let failureAlert = false;
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

  if (!updated) return;
  if (changed) await notify(updated, 'changed');
  else if (failureAlert) await notify(updated, 'error');
}
