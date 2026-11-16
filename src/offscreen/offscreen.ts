import type { OffscreenRequest, OffscreenResponse } from '../utils/types';

const BLOCK = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE',
  'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE',
  'SECTION', 'TABLE', 'TR', 'TD', 'TH', 'UL', 'BR', 'OPTION',
]);

function textOf(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(node.nodeValue ?? '');
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const block = BLOCK.has(el.tagName);
    if (block) out.push('\n');
    for (const c of el.childNodes) textOf(c, out);
    if (block) out.push('\n');
  }
}

function removeComments(doc: Document): void {
  const w = doc.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
  const found: Node[] = [];
  while (w.nextNode()) found.push(w.currentNode);
  found.forEach((n) => n.parentNode?.removeChild(n));
}

function extract(req: OffscreenRequest): OffscreenResponse {
  const doc = new DOMParser().parseFromString(req.html, 'text/html');

  doc.querySelectorAll('script, style, noscript, template, iframe').forEach((e) => e.remove());
  removeComments(doc);
  if (req.ignoreVolatile) doc.querySelectorAll('input[type="hidden"], meta').forEach((e) => e.remove());

  let roots: Element[];
  if (req.selector.trim()) {
    try {
      roots = [...doc.querySelectorAll(req.selector)];
    } catch {
      return { ok: false, error: 'Seletor CSS inválido' };
    }
    if (!roots.length) return { ok: false, error: 'Seletor não encontrado na página' };
  } else {
    roots = [doc.body ?? doc.documentElement];
  }

  const out: string[] = [];
  for (const r of roots) { textOf(r, out); out.push('\n'); }
  return { ok: true, text: out.join('') };
}

chrome.runtime.onMessage.addListener((msg: OffscreenRequest, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen' || msg.type !== 'extract') return;
  try {
    sendResponse(extract(msg));
  } catch (e) {
    sendResponse({ ok: false, error: `Falha ao analisar a página: ${(e as Error).message}` } satisfies OffscreenResponse);
  }
});
