import type { Translate } from './time';
import type { PickerContext } from './types';

export async function launchPicker(tabId: number, t: Translate, editId?: string): Promise<boolean> {
  const ctx: PickerContext = { strings: { pickerBar: t('pickerBar') }, editId };
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (c: PickerContext) => { (window as unknown as { __fofuPick?: PickerContext }).__fofuPick = c; },
      args: [ctx],
    });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['picker/picker.js'] });
    return true;
  } catch {
    return false;
  }
}

export function waitTabComplete(tabId: number, timeoutMs = 20_000): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { chrome.tabs.onUpdated.removeListener(onUpdated); clearTimeout(timer); resolve(); };
    const onUpdated = (id: number, info: chrome.tabs.TabChangeInfo) => { if (id === tabId && info.status === 'complete') done(); };
    const timer = setTimeout(done, timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId).then((tab) => { if (tab.status === 'complete') done(); }, done);
  });
}
