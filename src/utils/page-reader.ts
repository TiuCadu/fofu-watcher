
export const TAB_LOAD_TIMEOUT_MS = 30_000;
export const TAB_SETTLE_MS = 10_000;

const LOGIN_HINT = /log-?in|sign-?in|signin|entrar|acesso|auth|account-verification|verifica|captcha|challenge|consent/i;

export function isLoginRedirect(requested: string, final: string): boolean {
  let a: URL, b: URL;
  try { a = new URL(requested); b = new URL(final); } catch { return false; }
  if (a.hostname === b.hostname && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '')) return false;
  const target = b.hostname + b.pathname;
  return LOGIN_HINT.test(target) && !LOGIN_HINT.test(a.hostname + a.pathname);
}

export function shortUrl(url: string, max = 60): string {
  try {
    const u = new URL(url);
    const s = u.hostname + u.pathname;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  } catch { return url.slice(0, max); }
}

export type RenderedRead = { ok: true; text: string; url: string } | { ok: false; key: string; url: string };

export async function readRenderedText(selector: string, waitMs: number, stepMs = 700): Promise<RenderedRead> {
  const INVALID = '\u0000invalid';
  const read = (): string | null => {
    if (!selector) return document.body ? document.body.innerText : '';
    let els: Element[];
    try { els = Array.from(document.querySelectorAll(selector)); } catch { return INVALID; }
    if (!els.length) return null;
    return els.map((e) => (e as HTMLElement).innerText ?? e.textContent ?? '').join('\n');
  };
  const deadline = Date.now() + waitMs;
  let last: string | null = null;
  for (;;) {
    const cur = read();
    if (cur === INVALID) return { ok: false, key: 'errSelectorInvalid', url: location.href };
    if (cur !== null && cur.trim() !== '' && cur === last) return { ok: true, text: cur, url: location.href };
    if (Date.now() >= deadline) {
      return cur !== null ? { ok: true, text: cur, url: location.href } : { ok: false, key: 'errSelectorNotFound', url: location.href };
    }
    last = cur;
    await new Promise((r) => setTimeout(r, stepMs));
  }
}
