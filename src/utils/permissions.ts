
export function originPattern(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.hostname}/*`;
}

export const hasHostPermission = (url: string): Promise<boolean> =>
  chrome.permissions.contains({ origins: [originPattern(url)] });
