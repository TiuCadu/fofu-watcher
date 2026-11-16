
const VOLATILE: RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/g, 
  /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, 
  /\b\d{1,2}:\d{2}(?::\d{2})?\b/g, 
  /\b\d{1,2}h(?:\d{2})?\b/gi, 
  /\b\d[\d.,]*\s*(?:visualiza\p{L}+|views?|curtidas?|likes?|coment\p{L}+|compartilh\p{L}+|online|visitantes?|visitas?|segundos?|minutos?|horas?)(?![\p{L}\d])/giu,
  /\b(?=[\w-]*\d)(?=[\w-]*[A-Za-z])[\w-]{20,}\b/g, 
  /\b[0-9a-f]{16,}\b/gi, 
];

export function normalizeText(raw: string, ignoreVolatile: boolean): string {
  const lines: string[] = [];
  for (let line of raw.replace(/ /g, ' ').split(/\r?\n/)) {
    if (ignoreVolatile) for (const re of VOLATILE) line = line.replace(re, '');
    line = line.replace(/\s+/g, ' ').trim();
    if (line) lines.push(line);
  }
  return lines.join('\n');
}
