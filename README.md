# Fofu Watcher

Extensão (Manifest V3) para **Google Chrome e Brave** que monitora sites e avisa quando o conteúdo muda.
Tudo roda localmente: sem servidor externo, sem telemetria.

## Instalação (modo desenvolvedor)

Requisitos: Node.js 18+ (só para compilar).

```bash
npm install
npm run build      # gera a pasta dist/
```

**Chrome**
1. Abra `chrome://extensions`.
2. Ative **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione a pasta `dist/`.
4. Fixe o ícone na barra (menu de quebra-cabeça) para ver o badge.

**Brave**
1. Abra `brave://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta `dist/`.
4. Em Brave, confira em *Configurações → Sistema/Notificações* e nas notificações do Windows/macOS que o Brave pode exibir avisos.

Depois de alterar o código: `npm run build` e clique em **Recarregar** (↻) na página de extensões.
Outros comandos: `npm test` (testes de agenda/comparação/diff), `npm run typecheck`.

## Testes unitários

```bash
npm test          # só os testes
npm run check     # typecheck + testes + build (rode a cada alteração)
```

- Arquivo: `test/utils.test.ts` (runner: `test/run.mjs`, fuso fixo `America/Sao_Paulo`).
- Cobertura: agenda (horários fixos, dias da semana, intervalo, janela, janela que cruza a meia-noite), "Não perturbe", resumo da regra, normalização de texto, ignorar voláteis e diff por linhas.
- Código que depende de `chrome.*` não é testado unitariamente; por isso a lógica pura fica em `src/utils/`.
- **Fluxo para bugs:** escrever um teste `regressão: …` que falha → corrigir → teste passa → registrar no [CHANGELOG](CHANGELOG.md). Assim cada bug fica rastreável.

## Como usar

- **Adicionar uma página aberta:** clique no ícone → **+ Adicionar esta página** (a URL e o título já vêm preenchidos).
- **Adicionar manualmente:** ícone → ⚙ → **Adicionar site**.
- Ao salvar, o navegador pede permissão de acesso **apenas àquele site** (`optional_host_permissions`).
- A primeira verificação só guarda a versão base, sem notificar.
- **Agendamento** (por site):
  - *Horários fixos*: lista de horários e, opcionalmente, dias da semana.
  - *Intervalo*: a cada N minutos/horas, com janela opcional (ex.: 08:00–20:00).
  - O resumo da regra e a próxima verificação aparecem no formulário, no popup e na lista.
- Clicar na notificação (ou em **Ver mudanças**) abre a página de diff: verde = adicionado, vermelho = removido.
- Opções: som, “Não perturbe”, histórico (50 últimas mudanças por site), exportar/importar JSON.

## Arquitetura

```
src/background  service worker: alarm "tick", notificações, badge  | checker.ts: fetch→offscreen→hash→diff
src/offscreen   DOMParser: remove script/style/comentários, aplica o seletor CSS, extrai o texto
src/popup       lista de sites, status, "Verificar agora"
src/options     cadastro, agenda, histórico, configurações, backup
src/diff        página aberta pela notificação
src/utils       storage, tempo/agenda, normalização, diff, hash, permissões, helpers de UI
```

- **Agendamento:** cada site guarda seu `nextRun`. Um único `chrome.alarms` de 1 minuto acorda o service worker, que verifica os sites vencidos. O alarm é recriado em `onInstalled`, `onStartup` e a cada despertar do worker. Se o navegador estava fechado no horário, o `nextRun` vencido dispara a verificação atrasada ao abrir.
- **Detecção:** texto normalizado (espaços/quebras) → SHA-256 → comparação com o hash anterior.
- **Erros:** falhas (fora do ar, timeout de 30 s, 403, 404…) nunca apagam a versão base; há aviso após 3 falhas seguidas.

### Permissões
`storage`, `alarms`, `notifications`, `offscreen` e `activeTab` (só para ler a URL/título da aba atual quando você clica em “Adicionar esta página”). Acesso a sites: somente os cadastrados, sob demanda.

## Limitações conhecidas

- Sites que renderizam tudo com JavaScript (SPAs) devolvem pouco HTML no `fetch`; o conteúdo pode não aparecer. Uma melhoria futura seria abrir a aba em segundo plano.
- As verificações só ocorrem com o navegador aberto (as atrasadas rodam ao abrir) e o intervalo efetivo mínimo é de ~1 minuto.
- Sites com proteção anti-bot/captcha ou que exigem cabeçalhos especiais podem responder 403.
- Seletor CSS errado ou conteúdo dinâmico (anúncios, recomendações) gera falsos positivos; use o seletor e a opção de ignorar voláteis. A detecção de voláteis é heurística e pode ocultar mudanças reais em datas/horários/números seguidos de “horas”, “visitas” etc.
- Limite de armazenamento do `chrome.storage.local` (~10 MB): páginas muito grandes guardam a versão base inteira; o histórico guarda no máximo 300 linhas de diff por mudança.
- Após importar um backup é preciso conceder novamente as permissões dos sites (exigência do navegador).
- O diff é por linhas, sem destaque dentro da linha; em páginas enormes usa uma comparação por conjunto (sem ordem).
- Notificações dependem das configurações do sistema operacional (Foco/Não perturbe do SO também as silenciam).
