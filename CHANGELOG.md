# Changelog

Toda alteração é validada com `npm run check`. Bugs corrigidos citam o teste que os cobre.

## [1.0.0] — versão inicial
### Adicionado
- Extensão completa: cadastro, agenda (horários fixos / intervalo), detecção por hash, diff, notificações, badge, histórico, backup JSON.
- 14 testes unitários (`test/utils.test.ts`).

### Corrigido
- Contadores com letras acentuadas ("1.234 visualizações") não eram ignorados pela opção de voláteis, causando falso positivo. Cobertura: teste `voláteis: datas, horas, contadores e tokens são ignorados`.
