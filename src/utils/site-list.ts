import type { Site } from './types';

export function upsertSite(sites: Site[], site: Site): 'added' | 'updated' {
  const i = sites.findIndex((s) => s.id === site.id);
  if (i >= 0) { sites[i] = site; return 'updated'; }
  sites.push(site);
  return 'added';
}
