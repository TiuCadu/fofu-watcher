import { buildSelector } from '../utils/selector';
import type { PickerContext } from '../utils/types';

declare global {
  interface Window {
    __fofuPick?: PickerContext;
    __fofuPickerActive?: boolean;
  }
}

(() => {
  if (window.__fofuPickerActive) return;
  window.__fofuPickerActive = true;
  const ctx = window.__fofuPick ?? { strings: {} };
  const barText = ctx.strings.pickerBar ?? 'Click · ↑ parent · Esc';

  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>
    .box{position:fixed;border:2px solid #4f46e5;background:rgba(79,70,229,.18);border-radius:3px;pointer-events:none;display:none}
    .bar{position:fixed;top:12px;left:50%;transform:translateX(-50%);max-width:92vw;background:#1b1f2a;color:#fff;
      font:14px/1.4 system-ui,sans-serif;padding:8px 14px;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.35)}
  </style><div class="box"></div><div class="bar"></div>`;
  (shadow.querySelector('.bar') as HTMLElement).textContent = barText;
  const box = shadow.querySelector('.box') as HTMLElement;
  document.documentElement.append(host);

  let current: Element | null = null;

  const highlight = (el: Element | null) => {
    current = el;
    if (!el) { box.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  };

  const onMove = (e: MouseEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    highlight(el && el !== host ? el : null);
  };

  const stop = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); };

  const count = (sel: string) => { try { return document.querySelectorAll(sel).length; } catch { return 0; } };

  const finish = (picked: Element | null) => {
    cleanup();
    if (!picked) return;
    const whole = picked === document.body || picked === document.documentElement;
    const selector = whole ? '' : buildSelector(picked, count);
    const preview = (picked.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
    void chrome.runtime.sendMessage({
      type: 'pickerResult', selector, preview, url: location.href, title: document.title, editId: ctx.editId,
    });
  };

  const onClick = (e: MouseEvent) => { stop(e); finish(current); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { stop(e); finish(null); }
    else if (e.key === 'ArrowUp' && current?.parentElement) { stop(e); highlight(current.parentElement); }
  };
  const blocked = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'auxclick', 'contextmenu', 'dblclick'] as const;

  function cleanup() {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    for (const t of blocked) document.removeEventListener(t, stop, true);
    window.removeEventListener('scroll', rehighlight, true);
    host.remove();
    window.__fofuPickerActive = false;
  }
  const rehighlight = () => { if (current) highlight(current); };

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
  for (const t of blocked) document.addEventListener(t, stop, true);
  window.addEventListener('scroll', rehighlight, true);
})();
