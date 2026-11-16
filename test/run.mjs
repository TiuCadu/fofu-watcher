import * as esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fofu-test-'));
let failed = false;
for (const file of fs.readdirSync('test').filter((f) => f.endsWith('.test.ts')).sort()) {
  const out = path.join(dir, file.replace(/\.ts$/, '.mjs'));
  await esbuild.build({ entryPoints: [path.join('test', file)], outfile: out, bundle: true, platform: 'node', format: 'esm', logLevel: 'error' });
  console.log(`\n# ${file}`);
  const r = spawnSync(process.execPath, [out], { stdio: 'inherit', env: { ...process.env, TZ: 'America/Sao_Paulo' } });
  if (r.status !== 0) { failed = true; break; }
}
fs.rmSync(dir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
