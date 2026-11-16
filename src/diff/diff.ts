import { getSite, updateSite } from '../utils/storage';
import { h, hostOf, renderHistory } from '../utils/ui';

async function main(): Promise<void> {
  const id = new URLSearchParams(location.search).get('site') ?? '';
  const site = await getSite(id);
  const content = document.getElementById('content')!;
  if (!site) {
    content.append(h('div', { class: 'empty' }, 'Site não encontrado (talvez tenha sido removido).'));
    return;
  }
  document.getElementById('title')!.textContent = site.name || hostOf(site.url);
  const a = document.getElementById('url') as HTMLAnchorElement;
  a.href = site.url;
  a.textContent = site.url;
  content.append(renderHistory(site, true));

  if (site.unseen) await updateSite(id, (s) => { s.unseen = false; if (s.status === 'changed') s.status = 'ok'; });
}

void main();
