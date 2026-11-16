import type { Site } from './types';

export const sitesWithHistory = (sites: Site[]): Site[] => sites.filter((s) => s.history.length > 0);

export function deleteHistory(site: Site, which: ReadonlySet<number> | 'all'): number {
  const before = site.history.length;
  site.history = which === 'all' ? [] : site.history.filter((e) => !which.has(e.ts));
  if (!site.history.length) {
    site.unseen = false;
    if (site.status === 'changed') site.status = 'ok';
  }
  return before - site.history.length;
}
