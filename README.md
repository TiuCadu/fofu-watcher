# Fofu Watcher

🇧🇷 Português · [🇺🇸 English](README.en.md)

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
Outros comandos: `npm test` (testes de agenda, comparação, diff, idioma e hora), `npm run typecheck`.

## Testes unitários

```bash
npm test          # só os testes
npm run check     # typecheck + testes + build (rode a cada alteração)
```

- Arquivos: `test/utils.test.ts` (agenda, normalização, diff) e `test/i18n.test.ts` (idioma e formato de hora) e `test/selector.test.ts` (geração do seletor CSS) e `test/url.test.ts` (links clicáveis: só http/https). O runner `test/run.mjs` executa todo `test/*.test.ts`, com fuso fixo `America/Sao_Paulo`.
- Cobertura: agenda (horários fixos, dias da semana, intervalo, janela, janela que cruza a meia-noite), "Não perturbe", normalização de texto, ignorar voláteis e diff por linhas; **idioma e hora**: formatação 12h/24h com `Intl`, conversão 12h↔24h (ida e volta nos 1440 minutos do dia), resolução automática de idioma/formato, tradutor, **seletor visual** (para todo elemento de uma página de exemplo, o seletor gerado acha exatamente aquele elemento; ids/classes gerados automaticamente são ignorados) e **paridade dos dicionários** (mesmas chaves e parâmetros em pt-BR e en-US, nenhuma chave usada no código sem tradução).
- Código que depende de `chrome.*` não é testado unitariamente; por isso a lógica pura fica em `src/utils/`.
- **Fluxo para bugs:** escrever um teste `regressão: …` que falha → corrigir → teste passa → registrar no [CHANGELOG](CHANGELOG.md). Assim cada bug fica rastreável.

## Como usar

- **Adicionar uma página aberta:** clique no ícone → **+ Adicionar esta página** (a URL e o título já vêm preenchidos).
- **Adicionar manualmente:** ícone → ⚙ → **Adicionar site**.
- **Verificar agora:** o botão mostra o resultado na hora (primeira leitura guardada como base, sem mudanças, houve mudança ou o erro). Lembre: a primeira verificação nunca notifica.
- **Ir para a página monitorada:** no popup e na lista de sites, o nome do site é um link (e há o botão **Abrir página ↗** no popup); clique para abrir a página numa nova aba.
- **Monitorar só uma parte da página:** veja “Escolher a parte da página” abaixo.
- Ao salvar, o navegador pede permissão de acesso **apenas àquele site** (`optional_host_permissions`).
- A primeira verificação só guarda a versão base, sem notificar.
- **Agendamento** (por site):
  - *Horários fixos*: lista de horários e, opcionalmente, dias da semana.
  - *Intervalo*: a cada N minutos/horas, com janela opcional (ex.: 08:00–20:00).
  - O resumo da regra e a próxima verificação aparecem no formulário, no popup e na lista.
- Clicar na notificação (ou em **Ver mudanças**) abre a página de diff: verde = adicionado, vermelho = removido.
- Opções: idioma, formato de hora, som, “Não perturbe”, histórico (50 últimas mudanças por site), exportar/importar JSON.

### Escolher a parte da página (sem saber CSS)

Por padrão a página inteira é monitorada, o que gera avisos por mudanças que não importam (anúncios, relógios…). Para monitorar só um trecho (ex.: o preço):

1. Com a página aberta, clique no ícone → **◎ Escolher parte da página**.
2. Passe o mouse: o elemento sob o cursor é destacado. **Clique** no que quer monitorar (↑ escolhe o elemento pai; Esc cancela).
3. O formulário abre já preenchido, mostrando o que você escolheu. Use **Testar** para ver o texto que a extensão realmente enxerga naquele trecho.
4. Ao salvar, a extensão confere o trecho no HTML que ela recebe e avisa se não encontrar nada (veja a limitação abaixo).

Também dá para usar **Escolher na página** dentro do formulário (abre o site numa aba). O seletor CSS continua editável em **Avançado**. O seletor é gerado preferindo `id` e atributos estáveis (`data-testid`…) e evitando classes geradas automaticamente ou de estado.

### Idioma e formato de hora

Em **Opções → Configurações**:

- **Idioma:** *Seguir o navegador* (padrão), *Português (Brasil)* ou *English (US)*. Navegador em inglês → inglês; português ou qualquer outro idioma → português.
- **Formato de hora:** *Automático* (padrão: 24h em português, 12h em inglês), *24 horas* ou *12 horas*. É **independente do idioma**: dá para usar interface em inglês com 24h, ou em português com 12h.
- A troca vale **na hora** em popup, opções, histórico, diff e nas próximas notificações — sem recarregar nem reinstalar.
- O formato afeta: os horários fixos do agendamento (ex.: `18:00` ou `6:00 PM`), a janela do modo intervalo, o "Não perturbe", a última/próxima verificação e as datas do histórico.
- Os horários são **sempre guardados em 24h** (`"HH:mm"`) no `chrome.storage.local`; a conversão é só visual, então alternar entre 12h e 24h nunca corrompe agendamentos existentes.
- Como o `<input type="time">` nativo segue o idioma do sistema e não permite forçar 12h/24h, a extensão usa um seletor de hora próprio (hora, minuto e AM/PM no modo 12h).

## Arquitetura

```
src/background  service worker: alarm "tick", notificações, badge  | checker.ts: fetch→offscreen→hash→diff
src/offscreen   DOMParser: remove script/style/comentários, aplica o seletor CSS, extrai o texto
src/popup       lista de sites, status, "Verificar agora", "Escolher parte da página"
src/picker      seletor visual (injetado na página sob demanda)
src/options     cadastro, agenda, histórico, configurações, backup
src/diff        página aberta pela notificação
src/utils       storage, tempo/agenda/formatação (time.ts), i18n (i18n.ts), seletor de hora, normalização, diff, hash, permissões, helpers de UI
_locales/       dicionários pt_BR e en_US (messages.json) — fonte única de todos os textos
```

### Internacionalização

- **Nenhum texto fixo no código:** tudo vem de chaves em `_locales/pt_BR/messages.json` e `_locales/en_US/messages.json`. O HTML usa `data-i18n` (e `data-i18n-placeholder` / `-title` / `-aria-label`); o TypeScript usa `t('chave', { parametro })`.
- **`chrome.i18n`** (com `default_locale: pt_BR` no manifest) traduz o **nome e a descrição** da extensão (inclusive na loja), seguindo o idioma do navegador. Ele não permite troca manual.
- **Camada própria** (`src/utils/i18n.ts`): lê os **mesmos** `messages.json` conforme a preferência salva no storage, o que permite trocar o idioma dentro da extensão. Mensagens de erro são guardadas como `{ chave, parâmetros }` e traduzidas só na exibição, então também mudam de idioma ao vivo.
- Datas e horas usam `Intl.DateTimeFormat` com o locale escolhido (`pt-BR`/`en-US`) e o ciclo de horas (12h/24h).
- **Adicionar um idioma/texto:** inclua a chave nos dois `messages.json` (os testes falham se faltar em algum ou se os `{parâmetros}` divergirem).

- **Agendamento:** cada site guarda seu `nextRun`. Um único `chrome.alarms` de 1 minuto acorda o service worker, que verifica os sites vencidos. O alarm é recriado em `onInstalled`, `onStartup` e a cada despertar do worker. Se o navegador estava fechado no horário, o `nextRun` vencido dispara a verificação atrasada ao abrir.
- **Detecção:** texto normalizado (espaços/quebras) → SHA-256 → comparação com o hash anterior.
- **Erros:** falhas (fora do ar, timeout de 30 s, 403, 404…) nunca apagam a versão base; há aviso após 3 falhas seguidas.

### Permissões
`storage`, `alarms`, `notifications`, `offscreen`, `activeTab` e `scripting`. O `activeTab` lê a URL/título da aba atual quando você clica em “Adicionar esta página”; juntos, `activeTab` e `scripting` injetam o seletor visual **somente** na aba em que você clica em “Escolher parte da página” (nada é injetado automaticamente em sites). Acesso a sites: somente os cadastrados, sob demanda.

## Limitações conhecidas

- Sites que renderizam tudo com JavaScript (SPAs) devolvem pouco HTML no `fetch`; o conteúdo pode não aparecer. Uma melhoria futura seria abrir a aba em segundo plano.
- As verificações só ocorrem com o navegador aberto (as atrasadas rodam ao abrir) e o intervalo efetivo mínimo é de ~1 minuto.
- Sites com proteção anti-bot/captcha ou que exigem cabeçalhos especiais podem responder 403.
- O seletor visual enxerga a página já montada, mas a extensão busca o HTML bruto (`fetch`). Em sites que montam o conteúdo com JavaScript, o trecho escolhido pode não existir no HTML bruto; o teste ao salvar avisa, mas a monitoração desses sites pode não funcionar.
- O seletor visual não funciona em páginas internas do navegador (`chrome://`, `brave://`), na loja de extensões e em alguns visualizadores de PDF.
- Seletor CSS errado ou conteúdo dinâmico (anúncios, recomendações) gera falsos positivos; use o seletor e a opção de ignorar voláteis. A detecção de voláteis é heurística e pode ocultar mudanças reais em datas/horários/números seguidos de “horas”, “visitas” etc.
- Limite de armazenamento do `chrome.storage.local` (~10 MB): páginas muito grandes guardam a versão base inteira; o histórico guarda no máximo 300 linhas de diff por mudança.
- Após importar um backup é preciso conceder novamente as permissões dos sites (exigência do navegador).
- O diff é por linhas, sem destaque dentro da linha; em páginas enormes usa uma comparação por conjunto (sem ordem).
- Notificações dependem das configurações do sistema operacional (Foco/Não perturbe do SO também as silenciam).
