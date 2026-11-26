# Changelog

Toda alteração é validada com `npm run check`. Bugs corrigidos citam o teste que os cobre.

## [1.6.3] — Pronta para as lojas
### Alterado
- A descrição da extensão em português (exibida pelo navegador e pelas lojas) ficou igual à em inglês: "Monitora sites e avisa quando o conteúdo mudar. Tudo local, sem telemetria."

### Interno
- Política de privacidade em pt/en (`PRIVACY.md`), com link nos READMEs.
- Textos das lojas, justificativas das permissões e notas de revisão em `store/listing.md`; imagens das lojas em `store/images/` (`npm run store-images`).
- Prints da extensão nos READMEs, refeitos por `npm run screenshots`.
- Desenho do ícone movido do `build.mjs` para `scripts/icon.mjs` (os PNGs gerados não mudaram).
- Processo de release documentado no `CLAUDE.md`.

## [1.6.2] — Agenda com vários horários
### Corrigido
- **Depois de salvar, o card do site continuava mostrando a agenda antiga** (ex.: "Às 09:00" mesmo com 09:00 e 17:00 gravados). A gravação estava certa, mas a lista só se redesenha pelo `storage.onChanged`, que é ignorado com o formulário aberto, e o evento da gravação chega antes de o formulário fechar. Na edição nenhuma verificação roda logo em seguida, então nada redesenhava a lista até recarregar a página. Agora fechar o formulário redesenha a lista. Teste: `regressão: depois de salvar, o card do site mostra a agenda nova (ex.: 09:00 e 17:00)` (`test/regressions.test.ts`). Reproduzido e verificado no navegador real (Edge headless, perfil temporário): antes, storage `["09:00","17:00"]` e card "Às 09:00"; depois, card "Às 09:00, 17:00" com a próxima verificação às 17:00.
- **Na agenda por horário fixo, o 2º horário (ex.: 17:00) sumia ao salvar.** O horário escolhido no seletor só entrava na lista ao clicar em "Adicionar"; quem escolhia 17:00 e clicava direto em Salvar ficava só com o 09:00, sem nenhum aviso. Agora o horário escolhido e ainda não adicionado também é salvo (e já aparece na prévia "Próxima verificação"); se o seletor não foi mexido, nada é acrescentado (remover o último horário continua pedindo um horário). `fixedTimes` em `src/utils/time.ts`. Teste: `regressão: horário escolhido sem clicar em "Adicionar" é salvo junto com os já adicionados` (`test/utils.test.ts`).

## [1.6.1] — Salvar não duplica mais
### Corrigido
- **Clicar várias vezes em Salvar criava sites duplicados.** O salvamento espera a permissão do site e, às vezes, o teste do trecho (10–20 s lendo pela página aberta); nesse tempo cada clique extra (ou Enter) gravava o site de novo com outro id. Agora: (1) o botão fica desabilitado como "Salvando…" e cliques extras são ignorados; (2) o id do site novo é gerado uma vez, ao abrir o formulário, e a gravação é um *upsert* pelo id (`upsertSite`, `src/utils/site-list.ts`) — salvar de novo atualiza o mesmo site. Teste: `regressão: clicar em Salvar várias vezes no mesmo formulário não duplica o site` (`test/site-list.test.ts`). Verificado no navegador real com cliques de mouse reais: 3 cliques + Enter durante um salvamento lento = 1 site.

## [1.6.0] — Clicar antes de ler (avisos de idade/cookies)
### Adicionado
- Campo por site **Antes de ler, clicar no botão com o texto** (`Site.clickBefore`, só com "Ler abrindo a página"). Para sites que escondem o conteúdo atrás de um aviso — ex.: lojas Vendizap com "Você é maior de 18 anos? Sim / Não", em que o produto e o preço só são montados depois do "Sim" — ou banners de cookies. A extensão espera o botão com esse texto (sem diferenciar maiúsculas/espaços, ignorando invisíveis), clica **uma vez** e então lê. Se o botão não aparecer, lê normalmente; se o trecho já estiver na tela, não espera pelo botão.
- O campo aparece só com "Ler abrindo a página" marcado; mudar o texto recomeça a versão base; backup/importação preserva; a lista de sites mostra "clicando em “Sim” antes de ler".
- Testes em `test/page-reader.test.ts` (6 novos, incluindo `regressão: aviso de idade — clica em "Sim" e então lê o preço que só aparece depois`).
- Verificado no navegador real (Edge headless) contra uma página **local** que imita o aviso: sem o clique, preço não encontrado; com "Sim", "R$ 100,00"; "Verificar agora" detectou R$ 100,00 → R$ 101,00; nenhuma janela ficou aberta. (O site real não foi automatizado.)

## [1.5.1] — Uma só aba de opções
### Corrigido
- **+ Adicionar esta página** abria uma aba nova da extensão a cada clique. Agora reaproveita (e foca) a aba de opções que já estiver aberta, levando o formulário preenchido para ela. O resultado do seletor visual usa o mesmo caminho. A aba é encontrada com `chrome.runtime.getContexts` (enxerga as páginas da própria extensão sem a permissão `tabs`; a busca anterior por `chrome.tabs.query` podia não achá-la). Se essa aba tinha um formulário não salvo aberto, ele é substituído pelo novo.
- `src/utils/options-tab.ts` (`openOptionsTab`, `pickOptionsContext`). Teste: `regressão: "Adicionar esta página" reaproveita a aba de opções aberta` (`test/options-tab.test.ts`). Verificado no navegador real: 3 cliques seguidos = 1 aba, com o formulário do último site.

## [1.5.0] — Ler abrindo a página (Mercado Livre e sites com JavaScript)
### Adicionado
- Opção por site **Ler abrindo a página** (`Site.readMode = 'tab'`): a verificação abre o site numa janela minimizada (cookies/login do navegador e JavaScript), espera o trecho aparecer e estabilizar (até 10 s), lê o texto visível e fecha a janela sempre. Serve para sites que pedem login/verificação (ex.: Mercado Livre) e para os que montam o conteúdo com JavaScript. O **Testar** e o aviso ao salvar usam o mesmo modo.
- Detecção de **login/verificação**: no modo padrão (`fetch`), se o site redireciona para uma página de login/verificação/captcha (ex.: `/gz/account-verification` do Mercado Livre), o erro agora é "o site pediu login/verificação (…)", e o **Testar** sugere marcar "Ler abrindo a página" — antes aparecia "Seletor não encontrado".
- `src/utils/page-reader.ts`: `isLoginRedirect`, `shortUrl` e `readRenderedText` (função injetada na página, autocontida). Testes: `test/page-reader.test.ts` (9, incluindo `regressão: Mercado Livre redirecionando para account-verification é login/verificação`).
- Verificado no navegador real (Edge headless, servidor local): preço montado por JavaScript lido como "R$ 100" (fetch: vazio), redirecionamento para verificação reportado nos dois modos, "Verificar agora" detectou R$ 100 → R$ 101 e nenhuma janela ficou aberta.

### Alterado
- Trocar o modo de leitura recomeça a versão base. Backup/importação preserva o modo. A lista de sites mostra "lendo pela página aberta".
- Nenhuma permissão nova no manifest (`chrome.windows` não exige; o `scripting` usa a permissão do site já concedida).

## [1.4.1] — Intervalo pontual e cliques durante uma verificação
### Corrigido
- **Intervalo de N min rodava a cada N+1 min** (1 min virava 2). O alarm acorda a cada 1 min e o próximo horário era calculado a partir do fim da verificação, alguns segundos depois do tick; no tick seguinte o site estava "segundos adiantado" e era pulado. Agora `isDue` (`src/utils/time.ts`) aceita até 30 s de antecedência no passo normal do modo intervalo; horários fixos e o início da janela continuam sem antecedência. Testes: `regressão: intervalo de 1 min verifica a cada tick (não vira 2 min)` e `regressão: intervalo de 5 min verifica a cada 5 ticks` (`test/scheduling.test.ts`). Confirmado no navegador real (Edge headless, servidor local): a mudança passou a ser detectada no tick seguinte.
- **"Verificar agora" podia dizer "sem mudanças" e só o 2º clique mostrava a mudança** quando o clique coincidia com uma verificação automática do mesmo site: as duas liam a página nova, a primeira gravava a mudança e a segunda comparava com a base já atualizada. Agora há uma só verificação por site de cada vez (`singleFlight`, `src/utils/single-flight.ts`) e o clique recebe o resultado da que já está rodando. Teste: `regressão: clique durante uma verificação em andamento recebe o MESMO resultado`.

## [1.4.0] — Exclusão do histórico
### Adicionado
- **Opções → Histórico**: caixa de seleção em cada mudança, **Selecionar todas**, **Excluir selecionadas (N)**, **Excluir todas deste site** e **Limpar histórico de todos os sites**, sempre com confirmação.
- Regras em `src/utils/history.ts` (puras): `sitesWithHistory` e `deleteHistory`. A exclusão identifica as mudanças pela data (`ts`), não pela posição, para não apagar a errada se uma verificação inserir uma mudança nova no topo entre a tela e o clique. Não mexe na versão base; se o histórico do site ficar vazio, zera o "não visto" (badge).
- Testes: `test/history.test.ts` (7 testes, incluindo `regressão: exclui pela data (ts), não pelo índice…`).

### Alterado
- A aba **Histórico** só lista sites que já tiveram alguma mudança; sites ainda sem mudanças não aparecem (mensagem própria quando nenhum site tem histórico). Texto de ajuda atualizado nos dois idiomas.

## [1.3.4] — Alertas voltam a aparecer
### Corrigido
- **Nenhuma notificação de mudança aparecia.** O ícone da notificação usava o caminho relativo `icons/icon128.png`; no service worker ele é resolvido a partir de `background/`, o arquivo não existe e `chrome.notifications.create` falhava com "Unable to download all specified images". A mudança era gravada (histórico/badge), mas o alerta não saía e a verificação manual terminava em erro. Agora usa `chrome.runtime.getURL`. Teste: `regressão: iconUrl das notificações usa chrome.runtime.getURL` (`test/regressions.test.ts`).
- Uma falha ao notificar não derruba mais a verificação: a mudança continua sendo reportada como "mudou" e o erro vai para o console do service worker. Teste: `regressão: falha ao notificar não derruba a verificação`.
- Encontrado rodando a extensão compilada num navegador real (Edge headless, perfil temporário) contra a página de Mudanças recentes da Wikipédia; após a correção: 2ª/3ª verificação = "mudou" e notificação criada.

## [1.3.3] — Diagnóstico em "Verificar agora"
### Adicionado
- O resultado de "Verificar agora" mostra também o que foi lido: nº de caracteres do texto e uma impressão curta (início do SHA-256). Se a impressão não muda entre dois cliques num site que muda, a extensão está lendo sempre o mesmo conteúdo; se muda e o resultado diz "sem mudanças", o problema é a comparação. Usado para investigar um relato (Wikipédia: Mudanças recentes) que a análise offline, com o mesmo normalizeText/diffLines e HTML real, não reproduziu.

## [1.3.2] — Retorno visível em "Verificar agora"
### Corrigido
- **Verificar agora** parecia não fazer nada: sem mudança não havia nenhum sinal na tela (o "Última verificação" não mostra segundos), e falhas do service worker eram ignoradas. Agora o popup e a lista de opções mostram o resultado de cada verificação manual: "primeira leitura guardada como base", "sem mudanças", "houve mudança!" ou "falha: …". O botão fica desabilitado como "Verificando…" enquanto roda. Testes: `regressão: "Verificar agora" sempre devolve um texto` e `regressão: resposta ausente ou falha do worker não é ignorada` (`test/check-result.test.ts`).

## [1.3.1] — Correção da mensagem do teste
### Corrigido
- No formulário, **Testar** com a página inteira (sem seletor) e texto vazio dizia "O trecho foi encontrado, mas está vazio", o que confundia. Agora explica que a página inteira veio sem texto no HTML recebido (site montado com JavaScript, login/captcha ou redirecionamento) e que a monitoração não detectaria mudanças. A mensagem antiga continua só para quando há seletor. (Código de interface com `chrome.*`, sem teste unitário; a paridade das novas chaves pt/en é coberta pelo teste de dicionários.)

## [1.3.0] — Link para a página monitorada
### Adicionado
- O nome do site no popup e na lista de sites (opções) agora é um **link clicável** que abre a página monitorada numa nova aba; na lista de opções a URL também é link.
- Botão **Abrir página ↗** em cada site do popup.
- Só URLs http/https viram link (`isHttpUrl` em `src/utils/url.ts`); os links usam `rel="noopener noreferrer"`.
- Textos nos dois idiomas (`openSite`, `openSiteTitle`) e `test/url.test.ts`.

## [1.2.0] — Seletor visual (sem precisar saber CSS)
### Adicionado
- **◎ Escolher parte da página** no popup: injeta um seletor visual na aba atual (destaca o elemento sob o mouse; clique escolhe, ↑ escolhe o pai, Esc cancela). O formulário abre já preenchido.
- **Escolher na página** dentro do formulário (abre o site numa aba e injeta o seletor), inclusive ao editar um site existente.
- **Testar**: mostra o texto que a extensão realmente enxerga no trecho (HTML do `fetch`, via offscreen).
- Ao salvar um seletor novo/alterado, a extensão confere o trecho no HTML do `fetch` e avisa (com opção de salvar mesmo assim) se não achar nada — caso típico de sites que montam o conteúdo com JavaScript.
- Campo do seletor CSS movido para **Avançado**; resumo "Monitorando: a página inteira / só: …" e botão para voltar à página inteira.
- Gerador de seletor (`src/utils/selector.ts`): prefere id estável e atributos de teste (`data-testid`…), ignora ids/classes gerados automaticamente (hashes, CSS-in-JS) e classes de estado, e sobe pelos ancestrais só até ficar único.
- Permissão `scripting` (junto com `activeTab`): o picker só é injetado na aba em que o usuário clica; nada é injetado automaticamente.
- Testes: `test/selector.test.ts` (11 testes, com DOM falso e mini motor de seletores; propriedade: para todo elemento, o seletor gerado acha exatamente aquele elemento).

### Alterado
- Textos do seletor visual nos dois idiomas (`_locales`); `BgMessage` ganhou `testSelector` e `pickerResult`.

## [1.1.0] — Idioma e formato de hora
### Adicionado
- **Idioma da interface** (Português do Brasil / English US), padrão "seguir o navegador", com troca manual em Opções → Configurações.
- **Formato de hora** 12h/24h, padrão automático (24h pt, 12h en) e editável de forma independente do idioma.
- Troca **ao vivo** em popup, opções, histórico, diff e notificações (sem recarregar nem reinstalar).
- Seletor de hora próprio (`src/utils/timepicker.ts`) para horários fixos, janela do intervalo e "Não perturbe" — o `<input type="time">` nativo não permite forçar 12h/24h.
- Horários continuam guardados sempre em `"HH:mm"` (24h); a conversão é só visual.
- i18n: `_locales/pt_BR` e `_locales/en_US` (fonte única) + `default_locale` no manifest (nome/descrição traduzidos pelo `chrome.i18n`) + camada própria `src/utils/i18n.ts` para a troca manual. Nenhum texto fixo no código.
- Notificações e mensagens de erro traduzidas; erros guardados como `{key, params}` (strings antigas continuam sendo exibidas).
- README em inglês (`README.en.md`).
- Testes: `test/i18n.test.ts` (15 testes: formatação 12h/24h, ida e volta de 1440 horários, resolução de idioma/formato, tradutor, paridade dos dicionários, varredura de chaves usadas no código, manifest). O runner agora executa todo `test/*.test.ts`.

### Alterado
- `describeSchedule`, `formatDateTime`, `renderHistory`, `renderDiff` e `statusInfo` recebem o tradutor/formato (`t`, `fmt`).
- `Site.lastError` passa a aceitar `ErrorInfo` (`{key, params}`) além de string; `Settings` ganhou `language` e `hourFormat`.
- O hook de testes também reage a edições em `_locales/`.

## [1.0.0] — versão inicial
### Adicionado
- Extensão completa: cadastro, agenda (horários fixos / intervalo), detecção por hash, diff, notificações, badge, histórico, backup JSON.
- 14 testes unitários (`test/utils.test.ts`).

### Corrigido
- Contadores com letras acentuadas ("1.234 visualizações") não eram ignorados pela opção de voláteis, causando falso positivo. Cobertura: teste `voláteis: datas, horas, contadores e tokens são ignorados`.
