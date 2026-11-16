import { spawnSync } from 'node:child_process';
import path from 'node:path';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let file = '';
try {
  const p = JSON.parse(raw);
  file = p.tool_input?.file_path ?? p.tool_response?.filePath ?? '';
} catch { process.exit(0); }

const rel = path.relative(process.cwd(), path.resolve(file)).replaceAll('\\', '/');
const relevant = /^(src|test)\//.test(rel) || rel === 'build.mjs' || rel === 'manifest.json';
if (!file || !relevant) process.exit(0);

const r = spawnSync('npm test', { shell: true, encoding: 'utf8' });
if (r.status === 0) process.exit(0);

console.error(`❌ npm test falhou após editar ${rel}. Corrija antes de continuar.\n\n${r.stdout}\n${r.stderr}`.slice(0, 6000));
process.exit(2);
