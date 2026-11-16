
export interface SelNode {
  tagName: string;
  id: string;
  classList: ArrayLike<string>;
  parentElement: SelNode | null;
  children: ArrayLike<SelNode>;
  getAttribute(name: string): string | null;
}

export function cssEscape(v: string): string {
  return v.replace(/[^\w\u00a0-\uffff-]/g, (c) => `\\${c}`).replace(/^(\d)/, (_, d: string) => `\\3${d} `);
}

const UNSTABLE = /\d{4,}|^[a-f0-9]{8,}$|[a-f0-9]{8}-[a-f0-9]{4}|^(:r|ember|react|radix|headlessui|rc[-_]|mui-)/i;
const HASHY_CLASS = /^(css|sc|jsx|svelte|emotion|styled)[-_]|^[a-z]{1,3}[A-Z0-9]{5,}$/;
const STATE_CLASS = /^(active|selected|open|opened|show|shown|hidden|visible|hover|focus|focused|disabled|checked|current|expanded|collapsed|loading|loaded|is-.+|has-.+|js-.+|ng-.+)$/i;

export const isStableToken = (s: string): boolean => s.length > 0 && s.length <= 40 && !UNSTABLE.test(s);

const stableClasses = (el: SelNode): string[] =>
  Array.from(el.classList).filter((c) => isStableToken(c) && !HASHY_CLASS.test(c) && !STATE_CLASS.test(c));

const STABLE_ATTRS = ['data-testid', 'data-test', 'data-qa', 'data-cy', 'itemprop', 'name', 'aria-label'];

const stableId = (el: SelNode): string | null => (el.id && isStableToken(el.id) ? `#${cssEscape(el.id)}` : null);

const attrValue = (v: string) => v.replace(/["\\]/g, '\\$&');

function directCandidates(el: SelNode): string[] {
  const tag = el.tagName.toLowerCase();
  const out: string[] = [];
  const id = stableId(el);
  if (id) out.push(id);
  for (const a of STABLE_ATTRS) {
    const v = el.getAttribute(a);
    if (v && v.length <= 60 && isStableToken(v.replace(/\s+/g, '-'))) out.push(`[${a}="${attrValue(v)}"]`, `${tag}[${a}="${attrValue(v)}"]`);
  }
  const cls = stableClasses(el).slice(0, 3);
  for (let k = 1; k <= cls.length; k++) out.push(tag + cls.slice(0, k).map((c) => `.${cssEscape(c)}`).join(''));
  out.push(tag);
  return out;
}

function segmentFor(el: SelNode): string {
  const tag = el.tagName.toLowerCase();
  const cls = stableClasses(el).slice(0, 2).map((c) => `.${cssEscape(c)}`).join('');
  const parent = el.parentElement;
  if (!parent) return tag + cls;
  const sameTag = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
  return sameTag.length > 1 ? `${tag}${cls}:nth-of-type(${sameTag.indexOf(el) + 1})` : tag + cls;
}

export function buildSelector(el: SelNode, count: (selector: string) => number): string {
  for (const c of directCandidates(el)) if (count(c) === 1) return c;

  const segs: string[] = [];
  let node: SelNode | null = el;
  for (let depth = 0; node && node.tagName !== 'HTML' && depth < 8; depth++) {
    const anchor: string | null = node === el ? null : stableId(node);
    segs.unshift(anchor ?? segmentFor(node));
    const sel = segs.join(' > ');
    if (count(sel) === 1) return sel;
    if (anchor) break; 
    node = node.parentElement;
  }
  return segs.join(' > ');
}
