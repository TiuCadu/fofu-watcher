# Changelog

Toda alteração é validada com `npm run check`. Bugs corrigidos citam o teste que os cobre.

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
