export function isHttpUrl(url: string): boolean {
  try { return /^https?:$/.test(new URL(url).protocol); } catch { return false; }
}
