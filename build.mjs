import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const watch = process.argv.includes('--watch');
const OUT = 'dist';

const entries = [
  'src/background/service-worker.ts',
  'src/offscreen/offscreen.ts',
  'src/popup/popup.ts',
  'src/options/options.ts',
  'src/diff/diff.ts',
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
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function makeIcon(size) {
  const SS = 4; 
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const R = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS - R, py = y + (sy + 0.5) / SS - R;
        const nx = px / R, ny = py / R;
        const q = (v) => Math.pow(Math.abs(v), 5);
        if (q(nx) + q(ny) > 1) continue;
        let c = [79, 70, 229];
        const lens = Math.abs(ny) < 0.5 * (1 - nx * nx / 0.72) && Math.abs(nx) < 0.85;
        if (lens) c = [255, 255, 255];
        const d = Math.hypot(nx, ny);
        if (lens && d < 0.3) c = [79, 70, 229];
        if (lens && d < 0.12) c = [255, 255, 255];
        r += c[0]; g += c[1]; b += c[2]; a += 255;
      }
      const n = SS * SS, o = y * (size * 4 + 1) + 1 + x * 4;
      const cnt = a / 255 || 1;
      raw[o] = r / cnt; raw[o + 1] = g / cnt; raw[o + 2] = b / cnt; raw[o + 3] = a / n;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; 
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
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
