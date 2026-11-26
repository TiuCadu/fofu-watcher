# Fofu Watcher — contexto para o Claude

Extensão MV3 (Chrome/Brave) em TypeScript que monitora sites. Veja o README para arquitetura e uso.

## Regra obrigatória: testes a cada alteração
- **Depois de QUALQUER alteração em `src/`, `build.mjs` ou `manifest.json`, rode `npm run check`** (typecheck + testes + build) e informe o resultado ao usuário. Não considere a tarefa concluída com o check falhando.
- Testes unitários: `test/*.test.ts` (executados por `npm test`, via `test/run.mjs`, com `TZ=America/Sao_Paulo`). `utils.test.ts`: agenda (`computeNextRun`, janelas, "Não perturbe"), normalização/voláteis e diff. `i18n.test.ts`: formatação 12h/24h, conversão `to12h`/`from12h`, resolução de idioma/formato, tradutor, paridade dos dicionários e varredura das chaves usadas no código. `history.test.ts`: sites listados no Histórico e exclusão de mudanças. `scheduling.test.ts`: simulação do tick de 1 min (`isDue`) e verificações simultâneas (`singleFlight`). `page-reader.test.ts`: detecção de login/verificação e leitura do conteúdo montado (DOM falso, determinístico). `hash.test.ts`: impressão SHA-256 (vetores conhecidos, UTF-8). `timepicker.test.ts`: seletor de hora 12h/24h com DOM falso (valor sempre `"HH:mm"`). `selector.test.ts`, `url.test.ts`, `check-result.test.ts`. `readme.test.ts`: README pt/en com a mesma estrutura e o mesmo total de testes. `regressions.test.ts`: regressões em código com `chrome.*`, verificadas por varredura do código-fonte.
- **Mudou ou criou lógica pura em `src/utils/`?** Adicione/ajuste testes na mesma alteração.
- **Bug encontrado?** Primeiro escreva um teste que reproduz o bug (nome começa com `regressão:`), veja-o falhar, corrija e veja passar. Registre no `CHANGELOG.md` (seção "Corrigido") citando o nome do teste — isso dá a rastreabilidade.
- Código que usa `chrome.*` (background, popup, options) não tem teste unitário; mantenha a lógica nova em `src/utils/` (pura, sem `chrome.*`) sempre que possível para poder testá-la.
- Nunca apague/enfraqueça um teste para fazê-lo passar sem avisar o usuário.
- Os READMEs mostram o total de testes entre `<!-- test-count -->…<!-- /test-count -->`. O `test/run.mjs` conta as linhas `ok` e atualiza esse número sozinho nos dois quando todos passam; ao criar testes, inclua os READMEs alterados no commit e não edite o número à mão.

## Regra obrigatória: README em dois idiomas
- **Sempre atualize os dois READMEs juntos.** `README.md` (português) e `README.en.md` (inglês) têm **sempre o mesmo conteúdo**. Toda alteração em um entra no outro, traduzida, na mesma alteração e no mesmo commit — nunca só em um deles.
- O hook Stop bloqueia o encerramento da tarefa se só um dos dois estiver alterado no `git status`.
- `test/readme.test.ts` confere a estrutura (mesma sequência de títulos, mesma quantidade de blocos de código, mesmo total de testes). Ele não confere a tradução: o texto em si é responsabilidade de quem edita.

## Idioma e hora (i18n)
- **Nenhum texto fixo de interface no código.** Todo texto vem de `_locales/pt_BR/messages.json` e `_locales/en_US/messages.json` (fonte única, também usada pelo `chrome.i18n` no manifest). HTML: `data-i18n="chave"`; TS: `t('chave', { param })`. Ao criar/alterar texto, edite **os dois** idiomas — o teste de paridade falha se faltar chave ou divergirem os `{parâmetros}`.
- Mensagens de erro guardadas no storage são `{ key, params }` (`ErrorInfo`), traduzidas só na exibição com `errorText`.
- **Horários são sempre guardados em `"HH:mm"` (24h).** 12h/24h é só exibição: use `formatHM`/`formatDateTime` (`Intl`, com `hourCycle`) e o `mountTimePicker`. Nunca grave horário formatado no storage.
- Idioma e formato de hora são independentes (`Settings.language`, `Settings.hourFormat`). Telas devem reagir a `chrome.storage.onChanged` de `settings` e redesenhar sem recarregar.

## Seletor visual
- `src/picker/picker.ts` é injetado na página só sob demanda (`activeTab` + `scripting`), via `src/utils/picker-launch.ts`. Ele só envia o seletor e uma prévia curta ao service worker, que abre/atualiza a página de opções com `?add|edit&selector&preview`.
- A geração do seletor fica em `src/utils/selector.ts` (pura, testada em `test/selector.test.ts`). Mudou a heurística? Rode a propriedade "para TODO elemento…" e adicione um caso novo.
- Nada é injetado automaticamente em sites; não adicionar `content_scripts` no manifest nem permissões de host fixas.

## Modo "Ler abrindo a página"
- `Site.readMode`: `'fetch'` (padrão; ausente = fetch) ou `'tab'`. Em `checker.ts`, `readSite` escolhe; `readViaTab` abre janela minimizada e **sempre** fecha no `finally`.
- `readRenderedText` (`src/utils/page-reader.ts`) é injetada com `chrome.scripting.executeScript({ func })`: precisa ser **autocontida** (sem imports, sem variáveis externas, sem helpers do bundler — o build usa `target: chrome116`, sem `keepNames`).
- "Clicar antes de ler" (`Site.clickBefore`, só no modo tab): `readRenderedText` recebe o texto, clica uma vez no botão visível com esse texto e segue lendo mesmo se ele não aparecer. Só clica no que o usuário configurou.
- Detecção de login/verificação: `isLoginRedirect` (testada). Novos padrões de site que bloqueiam? Adicione um caso em `test/page-reader.test.ts`.

## Hook automático
`.claude/settings.json` define um hook PostToolUse (Edit|Write) que roda `scripts/hook-tests.mjs`: ao editar arquivos de `src/`, `test/`, `_locales/`, `build.mjs` ou `manifest.json`, executa `npm test`. Se falhar (exit 2), o erro volta para mim e devo corrigir antes de seguir. O hook só roda os testes; o `npm run check` completo (typecheck + build) continua sendo obrigatório ao concluir.

Há também um hook **Stop** (`scripts/hook-stop.mjs`), que roda quando vou encerrar uma tarefa. Ele usa o `git status` (depende do repositório git) e:
1. **Bloqueia** se só um dos READMEs (`README.md` ou `README.en.md`) estiver alterado, mesmo sem mudança de código.
2. **Bloqueia** se um `src/utils/*.ts` alterado não tiver teste correspondente: algum `test/*.test.ts` alterado ou criado precisa importá-lo (`from '../src/utils/<nome>'`, o padrão dos testes atuais). A mensagem lista só os arquivos sem teste. Dois casos ficam de fora, decididos pelo conteúdo do arquivo (sem lista fixa, valendo para arquivos novos):
   - **Usa `chrome.*`** (sem contar comentários) **e nenhum** `test/*.test.ts` do repositório o importa: não tem teste unitário, conforme a regra acima. Se algum teste já importa o arquivo (ex.: `i18n.ts`, `options-tab.ts`), a regra normal vale e devo ajustar o teste.
   - **Só exporta tipos** (`type`/`interface`): o esbuild do projeto apaga os tipos e não sobra código que roda. `types.ts` **não** se encaixa, porque tem constantes (`MAX_HISTORY` etc.).
3. Se mudou código do projeto (`src/`, `test/`, `_locales/`, `build.mjs`, `manifest.json`), roda o **`npm run check`** completo e bloqueia se falhar.

Ele bloqueia **no máximo 3 vezes** seguidas na sessão (o contador zera quando a verificação passa); na 4ª tentativa libera para não travar. Se eu não conseguir resolver (ex.: a mudança em `src/utils/` só mexe em código com `chrome.*`, que não tem teste unitário), devo **explicar o motivo ao usuário** em vez de encerrar calado.

## Comandos
- `npm run build` → gera `dist/` · `npm test` → testes · `npm run typecheck` → tsc em `src/` (`tsconfig.json`) e em `test/` (`tsconfig.test.json`) · `npm run check` → tudo
- Os tipos do Node (`@types/node`) só valem em `test/` (`tsconfig.test.json`); `src/` usa só `chrome`, para que nenhuma API do Node entre no código da extensão. Em testes, prefira `satisfies Tipo` a `as const` em objetos com arrays (o `as const` gera `readonly` e não bate com os tipos de `src/utils/types.ts`).
