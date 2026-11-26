# Textos para as lojas

Tudo o que as lojas pedem, pronto para copiar e colar. Imagens em `store/images/` (refazer com `npm run store-images`).
O pacote enviado é o zip da release do GitHub (o conteúdo de `dist/`).

- **Chrome Web Store:** https://chrome.google.com/webstore/devconsole (taxa única de US$ 5; vale também para o Brave)
- **Microsoft Edge Add-ons:** https://partner.microsoft.com/dashboard/microsoftedge (gratuito)

## Dados gerais

| Campo | Valor |
|---|---|
| Nome | Fofu Watcher (vem do `manifest.json`) |
| Categoria | Produtividade (Productivity) — no Chrome: "Ferramentas" (Tools) |
| Idiomas | Português (Brasil) e English (United States) |
| Site / suporte | https://github.com/TiuCadu/fofu-watcher |
| Política de privacidade | https://github.com/TiuCadu/fofu-watcher/blob/main/PRIVACY.md |
| Preço | Gratuito |

## Imagens

| Arquivo | Uso |
|---|---|
| `logo-300.png` | Edge: logo da loja (300×300) |
| `screenshot-1/2/3-pt.png` · `-en.png` | Capturas de tela (1280×800), uma série por idioma |
| `promo-440x280-pt.png` · `-en.png` | Chrome: bloco promocional pequeno (440×280) |
| `dist/icons/icon128.png` | Chrome: ícone da loja (128×128), já vem no pacote |

## Português (pt-BR)

**Resumo curto** (Chrome usa a descrição do manifest; Edge pede um resumo):
> Monitora sites e avisa quando o conteúdo mudar. Tudo local, sem telemetria.

**Descrição:**
```
Fofu Watcher vigia os sites que você escolher e avisa quando o conteúdo muda: preço e estoque de produto, edital de concurso, resultado, página de vagas, qualquer coisa que hoje você confere dando F5.

• Escolha só a parte que importa: clique em "Escolher parte da página" e aponte o trecho, sem precisar saber CSS.
• Agenda do seu jeito: horários fixos em dias da semana, ou a cada X minutos dentro de uma janela de horário. Tem também "Não perturbe".
• Veja exatamente o que mudou: o histórico mostra as linhas removidas e adicionadas em cada mudança.
• Funciona em sites que pedem login ou montam a página com JavaScript (ex.: Mercado Livre), com a opção "Ler abrindo a página". Dá até para clicar automaticamente em avisos de idade ou de cookies antes de ler.
• Ignora o que muda sempre (datas, horas, contadores) para não gerar alarme falso.
• Português e inglês, formato de hora 12h ou 24h.

Privacidade em primeiro lugar: tudo roda no seu navegador. Não há servidor, conta, anúncios nem telemetria. A extensão só acessa os sites que você adicionou, e o acesso a cada um é pedido a você ao salvar.

Código aberto (licença MIT): https://github.com/TiuCadu/fofu-watcher
```

**Termos de busca** (Edge, até 7): `monitor de sites` · `alerta de mudança` · `monitorar preço` · `aviso de alteração` · `vigiar página` · `notificação de site` · `diff`

## English (en-US)

**Short summary:**
> Monitors websites and notifies you when their content changes. Fully local, no telemetry.

**Description:**
```
Fofu Watcher watches the websites you choose and notifies you when their content changes: product prices and stock, exam announcements, results, job pages, anything you currently check by hitting F5.

• Watch only the part that matters: click "Pick part of the page" and point at it, no CSS needed.
• Schedule it your way: fixed times on chosen weekdays, or every X minutes within a time window. There is also "Do not disturb".
• See exactly what changed: the history shows the removed and added lines of every change.
• Works on sites that require login or build the page with JavaScript, with the "Read by opening the page" option. It can even click age or cookie notices automatically before reading.
• Ignores content that always changes (dates, times, counters) to avoid false alarms.
• Portuguese and English, 12h or 24h time format.

Privacy first: everything runs in your browser. No server, account, ads or telemetry. The extension only accesses the sites you added, and access to each one is requested from you when saving.

Open source (MIT license): https://github.com/TiuCadu/fofu-watcher
```

**Search terms** (Edge, up to 7): `website monitor` · `change detection` · `price tracker` · `page change alert` · `web page watcher` · `site notification` · `diff`

## Privacidade e permissões (formulários das lojas)

Os formulários são em inglês nas duas lojas; os textos abaixo já estão em inglês.

**Single purpose (propósito único):**
> Monitor web pages chosen by the user and notify them when the selected content changes.

**Justificativa de cada permissão:**

| Permissão | Justificativa |
|---|---|
| `storage` | Stores the user's list of monitored sites, the last read text of each one (to compare with the next check), the change history and the settings, locally in the browser. |
| `alarms` | Wakes the extension once a minute to run the checks the user scheduled (fixed times or intervals). |
| `notifications` | Tells the user that a monitored page changed, or that a site has been failing repeatedly. |
| `offscreen` | Parses the fetched HTML of a monitored page (DOMParser is not available in the service worker) to extract the part of the page the user picked. |
| `activeTab` | When the user clicks "Add this page" or "Pick part of the page" in the popup, reads the URL/title of the current tab and lets the user pick an element on it. |
| `scripting` | Injects the element picker into the current tab when the user asks for it, and reads the rendered text of a monitored page in the "Read by opening the page" mode. Nothing is injected automatically. |
| Host permission (`optional_host_permissions: *://*/*`) | Optional. Requested at runtime for one site at a time, only for the sites the user adds, so the extension can fetch them. Removing a site releases its permission. No site access is granted at install time. |

**Remote code:** No, I am not using remote code. (All code is bundled in the package.)

**Data usage (Chrome):** marque que **não coleta nenhum dado** do usuário. Certifique que os dados não são vendidos, não são usados para fins não relacionados ao propósito único e não são usados para crédito.

## Notas para a revisão (Edge: "Notes for certification")

```
Fofu Watcher is an open-source website change monitor (https://github.com/TiuCadu/fofu-watcher). Everything runs locally; there is no backend and no data collection.

How to test:
1. Click the toolbar icon, then "Add this page" on any website (e.g. https://example.com). The options page opens with the form filled in.
2. Click Save and accept the permission prompt for that site (host permissions are optional and requested per site).
3. Click "Check now": the first check stores a baseline. Change the page or wait for a scheduled check to see a change in the History tab.

Host access is never granted at install time: each site is requested individually when the user saves it, and released when the site is removed. The "scripting" permission is only used when the user clicks "Pick part of the page" or enables "Read by opening the page" for a site.
```
