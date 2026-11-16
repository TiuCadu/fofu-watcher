# Fofu Watcher — contexto para o Claude

Extensão MV3 (Chrome/Brave) em TypeScript que monitora sites. Veja o README para arquitetura e uso.

## Regra obrigatória: testes a cada alteração
- **Depois de QUALQUER alteração em `src/`, `build.mjs` ou `manifest.json`, rode `npm run check`** (typecheck + testes + build) e informe o resultado ao usuário. Não considere a tarefa concluída com o check falhando.
- Testes unitários: `test/utils.test.ts` (executados por `npm test`, via `test/run.mjs`, com `TZ=America/Sao_Paulo`). Cobrem as partes puras e críticas: agenda (`computeNextRun`, janelas, "Não perturbe"), normalização/voláteis e diff.
- **Mudou ou criou lógica pura em `src/utils/`?** Adicione/ajuste testes na mesma alteração.
- **Bug encontrado?** Primeiro escreva um teste que reproduz o bug (nome começa com `regressão:`), veja-o falhar, corrija e veja passar. Registre no `CHANGELOG.md` (seção "Corrigido") citando o nome do teste — isso dá a rastreabilidade.
- Código que usa `chrome.*` (background, popup, options) não tem teste unitário; mantenha a lógica nova em `src/utils/` (pura, sem `chrome.*`) sempre que possível para poder testá-la.
- Nunca apague/enfraqueça um teste para fazê-lo passar sem avisar o usuário.

## Hook automático
`.claude/settings.json` define um hook PostToolUse (Edit|Write) que roda `scripts/hook-tests.mjs`: ao editar arquivos de `src/`, `test/`, `build.mjs` ou `manifest.json`, executa `npm test`. Se falhar (exit 2), o erro volta para mim e devo corrigir antes de seguir. O hook só roda os testes; o `npm run check` completo (typecheck + build) continua sendo obrigatório ao concluir.

## Comandos
- `npm run build` → gera `dist/` · `npm test` → testes · `npm run typecheck` → tsc · `npm run check` → tudo
