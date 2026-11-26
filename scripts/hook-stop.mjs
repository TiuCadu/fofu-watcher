import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const MAX_BLOQUEIOS = 3;

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let input = {};
try { input = JSON.parse(raw); } catch { process.exit(0); }

const sessao = String(input.session_id ?? 'sem-sessao').replace(/[^\w-]/g, '');
const contadorPath = path.join(os.tmpdir(), `claude-stop-hook-${sessao}.json`);

function lerContador() {
  try { return JSON.parse(readFileSync(contadorPath, 'utf8')).bloqueios ?? 0; } catch { return 0; }
}
function liberar() {
  rmSync(contadorPath, { force: true });
  process.exit(0);
}
function bloquear(motivo) {
  const bloqueios = lerContador() + 1;
  if (bloqueios > MAX_BLOQUEIOS) {
    liberar();
  }
  writeFileSync(contadorPath, JSON.stringify({ bloqueios }));
  console.error(`${motivo}\n\n(tentativa ${bloqueios} de ${MAX_BLOQUEIOS}; se nao for possivel resolver, explique o motivo ao usuario)`.slice(0, 8000));
  process.exit(2);
}

const git = spawnSync('git', ['status', '--porcelain', '-uall'], { encoding: 'utf8' });
if (git.status !== 0) process.exit(0);

const alterados = git.stdout
  .split('\n')
  .filter(Boolean)
  .map((linha) => ({ status: linha.slice(0, 2), arquivo: linha.slice(3).split(' -> ').pop().replace(/^"|"$/g, '') }));

const ehCodigo = (f) => /^(src|test|_locales)\//.test(f) || f === 'build.mjs' || f === 'manifest.json';
if (!alterados.some(({ arquivo }) => ehCodigo(arquivo))) liberar();

const lerArquivo = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };

const semComentarios = (codigo) =>
  codigo.replace(/(['"`])(?:\\[\s\S]|(?!\1)[^\\])*\1|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => (m[0] === '/' ? ' ' : m));

const usaChrome = (f) => /\bchrome\s*\??\.\s*\w/.test(semComentarios(lerArquivo(f)));

let esbuild = null;
try { esbuild = createRequire(path.join(process.cwd(), 'package.json'))('esbuild'); } catch {}
const soTipos = (f) => {
  if (!esbuild) return false;
  try { return esbuild.transformSync(lerArquivo(f), { loader: 'ts', legalComments: 'none' }).code.trim() === ''; }
  catch { return false; }
};

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const importa = (codigo, f) => {
  const nome = escapar(f.replace(/^src\/utils\//, '').replace(/\.ts$/, ''));
  return new RegExp(`(?:\\bfrom|\\bimport)\\s*['"]\\.\\./src/utils/${nome}(?:\\.ts)?['"]`).test(codigo);
};
const ehTeste = (f) => /^test\/.+\.test\.ts$/.test(f);

let todosTestes = [];
try {
  todosTestes = readdirSync('test')
    .map((f) => `test/${f}`)
    .filter(ehTeste)
    .map((f) => semComentarios(lerArquivo(f)));
} catch {}

const testesAlterados = alterados
  .filter(({ status, arquivo }) => !status.includes('D') && ehTeste(arquivo))
  .map(({ arquivo }) => semComentarios(lerArquivo(arquivo)));

const isento = (f) => soTipos(f) || (usaChrome(f) && !todosTestes.some((codigo) => importa(codigo, f)));

const utilsAlterados = alterados
  .filter(({ status, arquivo }) =>
    !status.includes('D') &&
    /^src\/utils\/.+\.ts$/.test(arquivo) &&
    !arquivo.endsWith('.d.ts'))
  .map(({ arquivo }) => arquivo)
  .filter((f) => !isento(f));

const utilsSemTeste = utilsAlterados.filter((f) => !testesAlterados.some((codigo) => importa(codigo, f)));

if (utilsSemTeste.length > 0) {
  bloquear(
    `Voce alterou logica em src/utils/ sem adicionar ou ajustar testes em test/:\n` +
    utilsSemTeste.map((f) => `- ${f}`).join('\n') +
    `\n\nSiga a regra do CLAUDE.md: crie ou ajuste os testes unitarios para essas mudancas e rode \`npm run check\`.`
  );
}

const check = spawnSync('npm run check', { shell: true, encoding: 'utf8' });
if (check.status !== 0) {
  bloquear(`\`npm run check\` falhou. Corrija antes de encerrar a tarefa.\n\n${check.stdout}\n${check.stderr}`);
}

liberar();
