import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { makeIcon } from './scripts/icon.mjs';

const watch = process.argv.includes('--watch');
const OUT = 'dist';

const entries = [
  'src/background/service-worker.ts',
  'src/offscreen/offscreen.ts',
  'src/popup/popup.ts',
  'src/options/options.ts',
  'src/diff/diff.ts',
  'src/picker/picker.ts',
];

function copyStatic() {
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(html|css)$/.test(e.name)) {
        const dest = path.join(OUT, path.relative('src', p));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(p, dest);
      }
    }
  };
  walk('src');
  fs.copyFileSync('manifest.json', path.join(OUT, 'manifest.json'));
  fs.cpSync('_locales', path.join(OUT, '_locales'), { recursive: true });
}

function writeIcons() {
  fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });
  for (const s of [16, 48, 128]) fs.writeFileSync(path.join(OUT, 'icons', `icon${s}.png`), makeIcon(s));
}

const options = {
  entryPoints: entries,
  outdir: OUT,
  outbase: 'src',
  bundle: true,
  format: 'iife',
  target: 'chrome116',
  sourcemap: false,
  logLevel: 'info',
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
copyStatic();
writeIcons();

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('Observando alterações… (HTML/CSS: rode o build novamente)');
} else {
  await esbuild.build(options);
  console.log(`\nPronto: carregue a pasta "${OUT}" em chrome://extensions (modo desenvolvedor).`);
}
