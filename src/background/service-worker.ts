import { getSites } from '../utils/storage';
import type { BgMessage } from '../utils/types';
import { checkSite } from './checker';
import { ensureAlarm, runDue, TICK_ALARM } from './scheduler';

async function updateBadge(): Promise<void> {
  const n = (await getSites()).filter((s) => s.unseen).length;
  await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
  await chrome.action.setBadgeText({ text: n ? String(n) : '' });
}

const boot = async () => {
  await ensureAlarm();
  await updateBadge();
  await runDue(); 
};

chrome.runtime.onInstalled.addListener(() => void boot());
chrome.runtime.onStartup.addListener(() => void boot());
chrome.alarms.onAlarm.addListener((a) => { if (a.name === TICK_ALARM) void runDue(); });

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.sites) void updateBadge();
});

chrome.runtime.onMessage.addListener((msg: BgMessage & { target?: string }, _sender, sendResponse) => {
  if (msg?.target === 'offscreen') return; 
  const job = msg?.type === 'checkNow' ? checkSite(msg.id, true) : msg?.type === 'checkDue' ? runDue() : null;
  if (!job) return;
  job.then(() => sendResponse({ ok: true }), (e) => sendResponse({ ok: false, error: String(e) }));
  return true; 
});

const openDiff = (id: string) => chrome.tabs.create({ url: chrome.runtime.getURL(`diff/diff.html?site=${encodeURIComponent(id)}`) });
const siteIdOf = (notificationId: string) => notificationId.replace(/^fofu:/, '');

chrome.notifications.onClicked.addListener((nid) => { void openDiff(siteIdOf(nid)); chrome.notifications.clear(nid); });
chrome.notifications.onButtonClicked.addListener((nid, i) => { if (i === 0) void openDiff(siteIdOf(nid)); chrome.notifications.clear(nid); });

void ensureAlarm();
