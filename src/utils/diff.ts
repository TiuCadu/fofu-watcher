import type { DiffLine } from './types';

const MAX_CELLS = 4_000_000;

export function diffLines(a: string[], b: string[]): DiffLine[] {
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let ea = a.length, eb = b.length;
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  const x = a.slice(s, ea), y = b.slice(s, eb);
  const n = x.length, m = y.length;
  const out: DiffLine[] = [];

  if (n * m > MAX_CELLS) {
    const sx = new Set(x), sy = new Set(y);
    for (const l of x) if (!sy.has(l)) out.push({ t: 'del', line: l });
    for (const l of y) if (!sx.has(l)) out.push({ t: 'add', line: l });
    return out;
  }

  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i * w + j] = x[i] === y[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);

  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { i++; j++; }
    else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) out.push({ t: 'del', line: x[i++] });
    else out.push({ t: 'add', line: y[j++] });
  }
  while (i < n) out.push({ t: 'del', line: x[i++] });
  while (j < m) out.push({ t: 'add', line: y[j++] });
  return out;
}
