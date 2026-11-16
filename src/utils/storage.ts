import type { Settings, Site } from './types';

export const DEFAULT_SETTINGS: Settings = { sound: true, dndEnabled: false, dndStart: '22:00', dndEnd: '07:00' };

export async function getSites(): Promise<Site[]> {
  const r = await chrome.storage.local.get('sites');
  return (r.sites as Site[] | undefined) ?? [];
}

export async function getSite(id: string): Promise<Site | undefined> {
  return (await getSites()).find((s) => s.id === id);
}

export async function getSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(r.settings as Partial<Settings> | undefined) };
}

export const saveSettings = (settings: Settings) => chrome.storage.local.set({ settings });

let chain: Promise<unknown> = Promise.resolve();

export function mutateSites<T>(fn: (sites: Site[]) => T): Promise<T> {
  const run = chain.then(async () => {
    const sites = await getSites();
    const out = fn(sites);
    await chrome.storage.local.set({ sites });
    return out;
  });
  chain = run.catch(() => undefined);
  return run;
}

export const updateSite = (id: string, fn: (s: Site) => void): Promise<Site | undefined> =>
  mutateSites((sites) => {
    const s = sites.find((x) => x.id === id);
    if (s) fn(s);
    return s;
  });
