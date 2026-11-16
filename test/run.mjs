import * as esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fofu-test-'));
const out = path.join(dir, 'utils.test.mjs');
await esbuild.build({ entryPoints: ['test/utils.test.ts'], outfile: out, bundle: true, platform: 'node', format: 'esm', logLevel: 'error' });
const r = spawnSync(process.execPath, [out], { stdio: 'inherit', env: { ...process.env, TZ: 'America/Sao_Paulo' } });
fs.rmSync(dir, { recursive: true, force: true });
process.exit(r.status ?? 1);
