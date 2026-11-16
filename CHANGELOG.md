# Changelog

Toda alteração é validada com `npm run check`. Bugs corrigidos citam o teste que os cobre.

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
