import { applyI18n, loadI18n } from '../utils/i18n';
import { getSite, updateSite } from '../utils/storage';
import { clear, h, hostOf, renderHistory } from '../utils/ui';

const id = new URLSearchParams(location.search).get('site') ?? '';

async function render(): Promise<void> {
  const I = await loadI18n();
  applyI18n(I);
  const site = await getSite(id);
  const content = document.getElementById('content')!;
  clear(content);
  if (!site) {
    content.append(h('div', { class: 'empty' }, I.t('diffNotFound')));
    return;
  }
  document.getElementById('title')!.textContent = site.name || hostOf(site.url);
  const a = document.getElementById('url') as HTMLAnchorElement;
  a.href = site.url;
  a.textContent = site.url;
  content.append(renderHistory(site, I.t, I.fmt, true));

  if (site.unseen) await updateSite(id, (s) => { s.unseen = false; if (s.status === 'changed') s.status = 'ok'; });
}

chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c.settings) void render(); });
void render();
