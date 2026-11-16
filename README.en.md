# Fofu Watcher

[🇧🇷 Português](README.md) · 🇺🇸 English

A Manifest V3 extension for **Google Chrome and Brave** that monitors websites and notifies you when their content changes.
Everything runs locally: no external server, no telemetry.

## Installation (developer mode)

Requirements: Node.js 18+ (only to build).

```bash
npm install
npm run build      # generates the dist/ folder
```

**Chrome**
1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right corner).
3. Click **Load unpacked** and select the `dist/` folder.
4. Pin the icon to the toolbar (puzzle-piece menu) to see the badge.

**Brave**
1. Open `brave://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder.
4. In Brave, check *Settings → System/Notifications* and your Windows/macOS notification settings so Brave can show alerts.

After changing the code: `npm run build` and click **Reload** (↻) on the extensions page.
Other commands: `npm test` (schedule, comparison, diff, language and time tests), `npm run typecheck`.

## Unit tests

```bash
npm test          # tests only
npm run check     # typecheck + tests + build (run after every change)
```

- Files: `test/utils.test.ts` (schedule, normalization, diff) `test/i18n.test.ts` (language and time format) and `test/selector.test.ts` (CSS selector generation) and `test/url.test.ts` (clickable links: http/https only). The `test/run.mjs` runner executes every `test/*.test.ts` with a fixed `America/Sao_Paulo` time zone.
- Coverage: schedule (fixed times, weekdays, interval, window, window crossing midnight), "Do not disturb", text normalization, volatile-content filtering and line diff; **language and time**: 12h/24h formatting with `Intl`, 12h↔24h conversion (round trip over all 1440 minutes of the day), automatic language/format resolution, translator, **visual picker** (for every element of a sample page, the generated selector finds exactly that element; auto-generated ids/classes are ignored) and **dictionary parity** (same keys and parameters in pt-BR and en-US, no key used in code without a translation).
- Code that depends on `chrome.*` is not unit-tested, so pure logic lives in `src/utils/`.
- **Bug workflow:** write a failing `regressão: …` test → fix → test passes → log it in the [CHANGELOG](CHANGELOG.md), so every bug stays traceable.

## How to use

- **Add the open page:** click the icon → **+ Add this page** (URL and title come pre-filled).
- **Add manually:** icon → ⚙ → **Add site**.
- **Go to the monitored page:** in the popup and in the site list, the site name is a link (the popup also has an **Open page ↗** button); click to open the page in a new tab.
- **Monitor only part of a page:** see “Pick the part of the page” below.
- When saving, the browser asks for access **to that site only** (`optional_host_permissions`).
- The first check only stores the baseline version, without notifying.
- **Scheduling** (per site):
  - *Fixed times*: a list of times and, optionally, weekdays.
  - *Interval*: every N minutes/hours, with an optional window (e.g. 8:00 AM–8:00 PM).
  - The rule summary and the next check are shown in the form, the popup and the list.
- Clicking the notification (or **View changes**) opens the diff page: green = added, red = removed.
- Options: language, time format, sound, "Do not disturb", history (last 50 changes per site), JSON export/import.

### Pick the part of the page (no CSS needed)

By default the whole page is monitored, which triggers alerts for changes that do not matter (ads, clocks…). To monitor only a part (e.g. the price):

1. With the page open, click the icon → **◎ Pick part of the page**.
2. Move the mouse: the element under the cursor is highlighted. **Click** what you want to monitor (↑ selects the parent element; Esc cancels).
3. The form opens pre-filled, showing what you picked. Use **Test** to see the text the extension actually sees in that part.
4. When saving, the extension checks the part against the HTML it receives and warns if it finds nothing (see the limitation below).

You can also use **Pick on the page** inside the form (it opens the site in a tab). The CSS selector remains editable under **Advanced**. The selector prefers `id` and stable attributes (`data-testid`…) and avoids auto-generated or state classes.

### Language and time format

Under **Options → Settings**:

- **Language:** *Follow browser* (default), *Português (Brasil)* or *English (US)*. English browser → English; Portuguese or any other language → Portuguese.
- **Time format:** *Automatic* (default: 24h for Portuguese, 12h for English), *24-hour* or *12-hour*. It is **independent of the language**: you can run the English UI with 24h, or the Portuguese UI with 12h.
- Changes apply **immediately** in the popup, options, history, diff and upcoming notifications — no reload or reinstall.
- The format affects: fixed schedule times (e.g. `18:00` or `6:00 PM`), the interval-mode window, "Do not disturb", last/next check and history dates.
- Times are **always stored in 24h** (`"HH:mm"`) in `chrome.storage.local`; conversion is display-only, so switching between 12h and 24h never corrupts existing schedules.
- Because the native `<input type="time">` follows the OS language and cannot be forced to 12h/24h, the extension ships its own time picker (hour, minute and AM/PM in 12h mode).

## Architecture

```
src/background  service worker: "tick" alarm, notifications, badge  | checker.ts: fetch→offscreen→hash→diff
src/offscreen   DOMParser: strips script/style/comments, applies the CSS selector, extracts text
src/popup       site list, status, "Check now", "Pick part of the page"
src/picker      visual picker (injected into the page on demand)
src/options     sites, schedule, history, settings, backup
src/diff        page opened from the notification
src/utils       storage, time/schedule/formatting (time.ts), i18n (i18n.ts), time picker, normalization, diff, hash, permissions, UI helpers
_locales/       pt_BR and en_US dictionaries (messages.json) — single source of every string
```

### Internationalization

- **No hardcoded text in code:** everything comes from keys in `_locales/pt_BR/messages.json` and `_locales/en_US/messages.json`. HTML uses `data-i18n` (plus `data-i18n-placeholder` / `-title` / `-aria-label`); TypeScript uses `t('key', { param })`.
- **`chrome.i18n`** (with `default_locale: pt_BR` in the manifest) translates the extension **name and description** (including in the store), following the browser language. It does not allow manual switching.
- **Own layer** (`src/utils/i18n.ts`): reads the **same** `messages.json` files according to the preference saved in storage, which allows switching language inside the extension. Error messages are stored as `{ key, params }` and translated only when displayed, so they also switch language live.
- Dates and times use `Intl.DateTimeFormat` with the chosen locale (`pt-BR`/`en-US`) and hour cycle (12h/24h).
- **Adding a string/language:** add the key to both `messages.json` files (tests fail if one is missing or the `{parameters}` differ).

- **Scheduling:** each site stores its own `nextRun`. A single 1-minute `chrome.alarms` wakes the service worker, which checks the overdue sites. The alarm is recreated on `onInstalled`, `onStartup` and on every worker wake-up. If the browser was closed at the scheduled time, the overdue `nextRun` triggers a late check on startup.
- **Detection:** normalized text (whitespace/line breaks) → SHA-256 → comparison with the previous hash.
- **Errors:** failures (site down, 30 s timeout, 403, 404…) never delete the baseline; you are alerted after 3 consecutive failures.

### Permissions
`storage`, `alarms`, `notifications`, `offscreen`, `activeTab` and `scripting`. `activeTab` reads the current tab's URL/title when you click "Add this page"; together, `activeTab` and `scripting` inject the visual picker **only** into the tab where you click "Pick part of the page" (nothing is ever injected into sites automatically). Site access: only registered sites, on demand.

## Known limitations

- Sites that render everything with JavaScript (SPAs) return little HTML to `fetch`; content may not appear. A future improvement would be opening the tab in the background.
- Checks only run while the browser is open (late ones run on startup) and the effective minimum interval is ~1 minute.
- Sites with anti-bot/captcha protection or special header requirements may answer 403.
- The visual picker sees the fully rendered page, but the extension fetches the raw HTML (`fetch`). On sites that build content with JavaScript, the picked part may not exist in the raw HTML; the test on save warns you, but monitoring those sites may not work.
- The visual picker does not work on browser-internal pages (`chrome://`, `brave://`), the extension store, and some PDF viewers.
- A wrong CSS selector or dynamic content (ads, recommendations) causes false positives; use the selector and the volatile-content option. Volatile detection is heuristic and may hide real changes in dates/times/numbers followed by "hours", "visits", etc.
- `chrome.storage.local` quota (~10 MB): very large pages store the whole baseline; history keeps at most 300 diff lines per change.
- After importing a backup you must grant the site permissions again (browser requirement).
- The diff is line-based, with no intra-line highlighting; for huge pages it falls back to a set comparison (no ordering).
- Notifications depend on OS settings (the OS Focus/Do-not-disturb mode also silences them).
- Only Portuguese (Brazil) and English (US) are provided; the extension name/description shown by the browser/store falls back to Portuguese for other browser languages.
- The date order follows the chosen locale (e.g. `04/03/2026` in pt-BR vs `03/04/2026` in en-US).
