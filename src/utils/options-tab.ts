
interface PageContext { documentUrl?: string; tabId: number; windowId: number }

export function pickOptionsContext<C extends PageContext>(contexts: C[], optionsBase: string): C | undefined {
  return contexts.find((c) => c.tabId >= 0 && !!c.documentUrl && (c.documentUrl === optionsBase || c.documentUrl.startsWith(`${optionsBase}?`) || c.documentUrl.startsWith(`${optionsBase}#`)));
}

export async function openOptionsTab(query?: URLSearchParams): Promise<void> {
  const base = chrome.runtime.getURL('options/options.html');
  const qs = query?.toString();
  const url = qs ? `${base}?${qs}` : base;
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['TAB' as chrome.runtime.ContextType] }).catch(() => []);
  const open = pickOptionsContext(contexts, base);
  if (open) {
    const ok = await chrome.tabs.update(open.tabId, { url, active: true }).then(() => true, () => false);
    if (ok) {
      if (open.windowId >= 0) await chrome.windows.update(open.windowId, { focused: true }).catch(() => undefined);
      return;
    }
  }
  await chrome.tabs.create({ url });
}
