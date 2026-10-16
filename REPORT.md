# A11y Verification Report

Este relatório compila as evidências de conformidade da página do projeto DA11Y.md, criado a partir de `templates/REPORT.md` (pt-BR) do A11Y.md.

> Este relatório é um **registro versionado do projeto** — nunca adicione ao `.gitignore`.

> **Legenda de marcação (obrigatória):**
> `[x]` verificado, com a evidência descrita ao lado · `[!]` verificado e **reprovado** · `[~]` verificado parcialmente, com o que falta escrito · `[ ]` **não verificado** — com o motivo ao lado.

---

## 📌 Contexto da Validação
- **Funcionalidade/Épico:** página pública do DA11Y.md (`pagina/index.html`), bilíngue desde 13/10 (português e inglês, com o botão de idioma no topo do hero), com o hero animado (`hero.js`, WebGL2), a gota da primeira seção (`drip.js`) e as ondas do clique na água (`ripples.js`). Fora do escopo: `pagina/componentes/` (página de amostra de componentes, não publicada como parte do site) e `hero/` (a página de ajustes do laboratório). O gate roda com `--src pagina`.
- **Data do Teste:** 16/10/2026, para as mudanças das notas 11 a 13. O resto da página foi verificado em 13/10/2026.
- **Cobre a interface em:** `pagina/index.html` sha256 `513c2314e3e0…`, `hero.js` `204e09dc7cc3…`, `drip.js` `68e889e957b7…`, `ripples.js` `80da4ad08902…`, `layers.json` `c4d8aded09f8…` (16/10/2026, por hash, porque este relatório entra no mesmo commit que a página). Entregue no GitHub Pages pelo repositório `fecarrico/da11ymd` (https://fecarrico.github.io/da11ymd/). A primeira publicação foi em 13/10/2026. Antes, a página foi publicada como artefato do claude.ai para avaliação, até a versão 25.
- **Versão do padrão:** 2.4.0
- **Status de Conformidade:** ⚠️ CONDICIONAL — passa nas verificações automáticas e de teclado refeitas por outro agente; continuam sem verificação os leitores de tela, os aparelhos reais, o controle por voz, a paleta real de alto contraste, a análise certificada de clarões e as recomendações da NBR 17225 (nível Pleno).
- **Independência da Verificação:** cross-agent — *mudança de 16/10 (nota 11): um subagente auditor do Claude Code (mesmo modelo, contexto próprio, sem a conversa que gerou o código), em 16/10/2026, com Chromium via Playwright, `contrast-check.py --profile shield`, tamanho de texto a 200% pelo CDP, um contexto com JavaScript desligado e medidas em pixel. Ele aprovou os nove itens que conferiu. Depois dele, uma frase de legenda entrou na figura das anotações, conferida só pela IA que escreveu o código (autodeclarado). Página bilíngue, controles do topo e categorias das anotações: um subagente auditor do Claude Code (mesmo modelo, contexto próprio, sem a conversa que gerou o código), em 13/10/2026, com Chromium 1234 via Playwright 1.64, axe-core 4.11.3 com 104 regras, `contrast-check.py` e medidas em pixel. Ele reprovou duas coisas (nota 9), que foram corrigidas e conferidas rodando de novo os scripts dele, pela IA que escreveu o código (autodeclarado). Antes disso, quem verificou: subagente auditor do Claude Code (mesmo modelo, contexto próprio, sem a conversa que gerou o código), em quatro rodadas em 13/10/2026 (auditoria completa, conferência das correções, confirmação final e painéis de abas pelo APG), com Chromium 1234 via Playwright, axe-core 4.10.2, `contrast-check.py` e medidas em pixels renderizados. Os scripts e as capturas ficaram na pasta de trabalho da sessão, fora do repositório. Depois da quarta rodada, três ajustes que ele apontou foram feitos e conferidos só pela IA (autodeclarado): o painel desce 0,75rem para o contorno de foco não encostar na linha das abas, a margem do parágrafo de abertura depois do título escondido saiu, e um comentário do script foi corrigido.*
- **Gate estático (`verify-a11y.py`):** PASS (0 erros; 8 avisos, ver nota 8) — *rodado em: 16/10/2026, com `--src pagina`, depois da mudança da nota 11.*

## Guias carregados (mapa §2.1)

| Na página | Guia | Quando foi lido |
| :--- | :--- | :--- |
| Botões, CTAs, botões de copiar | `guide-buttons` | 10/10 e 12/10 |
| Imagens dos cards, faixa do A11Y.md, imagem parada | `guide-images` | 10/10 |
| Cena animada, paralaxe, gota, ondas, pausa | `guide-media` | 10/10; §4 relido em 13/10 |
| Abas de "Como começar" | `guide-tabs-accordion` | 13/10, depois do defeito do painel |
| Link para pular, regiões, links em nova aba | `guide-navigation` | 13/10 |
| Mensagem "Copiado." (`role="status"`) | `guide-toasts-notifications` | 13/10 |
| Larguras, zoom, alvos de toque, celular | `guide-responsive-mobile` | 13/10 |
| Conteúdo revelado por script (abas sem JS) | `guide-loading-skeleton` | 13/10 |
| Textos, siglas, espaçamento de texto | `guide-cognitive` §4 e §6 | 13/10 |
| Público brasileiro, siglas | `guide-sign-language-br` | 13/10 |
| Paleta e tokens | `guide-visual-perception` §3 e §4 | 13/10 |
| Perfil Shield | `guide-compliance-profiles` | 13/10 |
| Botão de idioma e controles do topo | `guide-buttons`, `guide-navigation`, `guide-responsive-mobile` | 13/10, de novo, para a página bilíngue |
| Escolha entre switch, rádio e botão para o idioma | `guide-form-controls` §0, §2 e §3 | 13/10 (não há switch nem rádio na página; o guia decidiu o botão) |
| Página em inglês escondida até a tradução entrar | `guide-loading-skeleton` | 13/10, de novo |
| Cores das categorias das anotações | `guide-visual-perception` §3 | 13/10, de novo |
| Textos em inglês e rótulos novos | `guide-cognitive` §6 | 13/10, de novo |
| Botão-link para a skill na Comunidade do Figma, em nova aba | `guide-buttons`, `guide-navigation` | o padrão já validado em 13/10, reaproveitado em 16/10 sem reler os guias |

Vários guias foram lidos só depois de defeitos achados pelo Felipe.

## 1. Verificação Técnica (Automated & Semantics)
- [x] **Axe-Core:** 0 violações com as regras AAA, as experimentais e `label-content-name-mismatch` ligadas, em 1280 px e 320 px e nos três estados das abas. Na página bilíngue (13/10, axe-core 4.11.3, 104 regras): 0 violações em português, em inglês e depois da troca pelo botão, em 1280 e 320 px. Os itens "incomplete" são contraste sobre textura e foram cobertos pela medida em pixels (seção 4). *(auditor, 13/10)*
- [x] **Semântica HTML:** controles nativos (`button`, `a`), passos em `<ol>`, abas com o padrão completo (`tablist`, `tab`, `tabpanel`, `aria-selected`, `aria-controls`, setas, Home e End), regiões `banner`, `main` e `contentinfo`. Documento completo: `doctype`, `<html lang="pt-BR">`, charset e viewport (`compatMode` = `CSS1Compat`; no celular emulado, escala 1).
- [x] **Hierarquia de Títulos:** um `h1` ("dally.md, design accessibility", em `sr-only`, com a frase em `lang="en"`), sem saltos de nível.

## 2. Tab Order e Focus Management
- [x] **Indicador de Foco:** cantoneiras de 3 px nos botões, abas e cards, em tinta sobre papel (11,84:1), medidas em 4× nos quatro lados. Contorno de 3 px nos links do texto. O link para pular e os dois controles do topo (idioma e pausa) têm contorno com halo de papel, porque ficam sobre a cena: anel de 3 px, 11,84:1, área que muda de 1051 a 1775 px² contra o mínimo de 496 a 944 px² (SC 2.4.13, medido em pixel pelo auditor em 13/10). Em `forced-colors`, contorno comum nos quatro lados (geometria conferida; cores do sistema não, ver seção 3).
- [x] **Navegação Lógica:** link para pular → idioma → pausa → A11Y.md → Como começar → GitHub → aba (uma parada) → painel da aba → Copiar pedido para criar → Copiar pedido para analisar → A11Y.md → guia de contribuição → 3 cards → LinkedIn → A11Y.md. Shift+Tab faz o caminho inverso. Nenhuma armadilha e nenhuma parada em contêiner.
- [x] **Foco Capturado:** N/A — a página não tem modal nem sobreposição.

## 3. Comportamento e Retorno de Tarefas
- [ ] **Screen Reader Test:** não executado. O agente não tem leitor de tela. **Quem deve rodar:** Felipe, com pelo menos um par (por exemplo NVDA + Firefox, ou VoiceOver + Safari no iPhone).
  - Par(es) usado(s): nenhum.
  - Quem executou e quando: ninguém ainda.
  - Cenários (bloco *Expected behavior* de cada guia). "Teclado" foi navegado pelo auditor; "árvore" foi lido na árvore de acessibilidade (CDP), sem ouvir o leitor de tela; "pendente" espera o teste com leitor de tela.

    | Guia | Cenário | Resultado |
    | :--- | :--- | :--- |
    | guide-buttons | Tab passa por cada botão com foco visível | aprovado (teclado) |
    | guide-buttons | Enter e Espaço acionam a mesma ação do clique | aprovado (teclado: copiar e pausar) |
    | guide-buttons | Nada com cara de botão é pulado | aprovado (teclado) |
    | guide-buttons | Nome seguido de "botão" | árvore: `button` com nome; pendente |
    | guide-buttons | Lista de botões com nomes que se explicam fora de contexto | árvore: nomes únicos ("Copiar pedido para criar", "… para analisar"); pendente |
    | guide-buttons | Botão só com ícone | N/A (não há) |
    | guide-buttons | Gestos no celular (deslizar, toque duplo) | pendente |
    | guide-media | Nenhum áudio; Tab nunca cai na cena; botão de pausa alcançável | aprovado (teclado; canvas `aria-hidden`) |
    | guide-media | Enter na pausa para tudo e o botão passa a "Retomar animação" | aprovado (teclado, 390, 768 e 1280) |
    | guide-media | Com movimento reduzido, nada se move sozinho e o paralaxe fica parado | aprovado |
    | guide-media | Ao ler o hero, a cena nunca é anunciada | árvore: canvas fora da árvore; pendente |
    | guide-media | O novo nome do botão é anunciado | pendente |
    | guide-buttons | Botão de idioma: Tab chega nele logo depois do link para pular, com foco visível | aprovado (teclado, pt e en, 1280 e 320 px; auditor) |
    | guide-buttons | Botão de idioma: Enter e Espaço trocam o idioma, o foco fica no botão e o rótulo passa a ser o outro idioma, com o `lang` dele | aprovado (teclado; auditor) |
    | guide-buttons | Botão de idioma: nome igual ao texto visível ("English", "Português") | aprovado (árvore; auditor) |
    | guide-toasts-notifications | Troca de idioma anunciada uma vez, no idioma novo ("Page in English." / "Página em português.") | código e árvore: região `role="status"` vazia aos 60 ms e com o texto aos 400 ms, com o `lang` certo; pendente |
    | guide-navigation | Página em português sem JavaScript, e página que não fica escondida quando o script de idioma falha | aprovado (sem JS: conteúdo visível em `pt-BR`, sem os controles; auditor) |
    | guide-media | Player e player incorporado | N/A (não há) |
    | guide-tabs-accordion | Tab entra na lista pela aba selecionada, uma parada | aprovado (teclado) |
    | guide-tabs-accordion | Setas trocam a aba e só o painel dela aparece | aprovado (teclado, com Home e End) |
    | guide-tabs-accordion | Tab numa aba vai para dentro do painel | aprovado (teclado: o foco vai ao painel, com contorno de 3 px, e o Tab seguinte ao primeiro botão; Shift+Tab volta pelo mesmo caminho; ver nota 2) |
    | guide-tabs-accordion | "aba, 1 de 3" e "selecionada" | árvore: `tab` com `aria-selected`; pendente |
    | guide-tabs-accordion | Accordion | N/A (não há) |
    | guide-navigation | O primeiro Tab cai no link para pular, visível | aprovado (teclado) |
    | guide-navigation | Enter no link para pular leva o próximo Tab para dentro do conteúdo | aprovado (teclado) |
    | guide-navigation | Menu, submenu, rota sem recarregar | N/A (página única, sem menu) |
    | guide-navigation | Saltar por região | árvore: `banner`, `main`, `contentinfo`; pendente |
    | guide-navigation | Cada link se explica fora de contexto, com "abre em nova aba" | aprovado (árvore: os 10 links em nova aba dizem "(abre em nova aba)") |
    | guide-toasts-notifications | O foco fica onde estava quando a mensagem aparece | aprovado (teclado: o foco fica no botão de copiar) |
    | guide-toasts-notifications | Mensagem com ação, Esc, desfazer | N/A (a mensagem não tem ação) |
    | guide-toasts-notifications | A mensagem é anunciada uma vez | código: região `role="status"` existe antes e recebe o texto depois de 120 ms; pendente |
    | guide-loading-skeleton | Sem script, todo o conteúdo fica visível e alcançável pelo Tab | aprovado (sem JS: os três blocos de "Como começar" empilhados, com títulos) |
    | guide-loading-skeleton | Esqueletos e anúncios de carregamento | N/A (não há) |

- [x] **Controle por Voz:** cada nome acessível começa pelo texto visível do controle.
  - Ferramenta ou método: leitura dos nomes acessíveis contra os rótulos visíveis (árvore CDP) e regra `label-content-name-mismatch` do axe, com 0 ocorrências. Nenhuma ferramenta de voz real foi usada.
- [x] **Estados interativos inventariados:**
  - Abas: os três estados de seleção foram navegados.
  - Botão de pausa: "Pausar animação" e "Retomar animação" (em inglês, "Pause animation" e "Resume animation"), com o estado inicial vindo de `prefers-reduced-motion`, foram navegados.
  - Botão de idioma: "English" na página em português e "Português" na página em inglês, cada um com o próprio `lang`; a escolha salva, a escolha pelo navegador e a volta foram navegadas.
  - Botão de copiar: "Copiado." e a mensagem de reserva sem permissão de área de transferência foram navegados.
  - Link para pular: escondido e com foco, navegados.
  - Cards: com foco foi navegado; com o mouse em cima foi lido no código.
  - Frase do topo: com textura e com `prefers-contrast: more` (sem textura) foram lidos no código.
- [~] **Mudança de Status (`aria-live`):** a mensagem de cópia vai para uma região `role="status"`, que já existe antes do clique (conferido no código e navegado). Falta ouvir num leitor de tela.
- [x] **Preenchimento de Formulários:** N/A — a página não tem campo de formulário.

## 4. Percepção Visual e Compreensão
- [x] **Contraste de Texto & UI:** pares calculados com `contrast-check.py --profile shield`.
  | Par | Primeiro plano | Fundo | Razão | Piso | Resultado |
  | :--- | :--- | :--- | ---: | ---: | :--- |
  | texto corrido, títulos, links, anel de foco | #141414 | #d1cfcb | 11.84:1 | 7:1 | ✅ |
  | texto secundário | #3a3834 | #d1cfcb | 7.52:1 | 7:1 | ✅ |
  | texto na faixa escura (curiosidade, card escuro) | #d1cfcb | #141414 | 11.84:1 | 7:1 | ✅ |
  | legenda na faixa escura | #b3b0aa | #141414 | 8.52:1 | 7:1 | ✅ |
  | título do card de anotação | #ffffff | #2c2c2c | 13.97:1 | 7:1 | ✅ |
  | texto do card de anotação | #e6e6e6 | #2c2c2c | 11.19:1 | 7:1 | ✅ |
  | chip "Accessibility" (token mantido; a página não desenha mais esse chip) | #ffffff | #a50f68 | 7.32:1 | 7:1 | ✅ |
  | chip "Decisão sua" / "Your decision" | #ffffff | #0e53ae | 7.32:1 | 7:1 | ✅ |
  | chip "Erro do design system" / "Design system error" | #ffffff | #7212df | 7.32:1 | 7:1 | ✅ |
  | chip "Corrigir aqui" / "Fix here" | #141414 | #f2913a | 7.80:1 | 7:1 | ✅ |

  Fora da tabela, porque não é um par de cores fixas, a frase do topo ("Make your F accessible", e desde 13/10 "Deixe seu F acessível" em português) tem textura de luz por dentro das letras. Medida em pixels renderizados contra a faixa de papel: média de 9,29 a 9,35:1, 1º percentil de 7,0 a 7,21:1 e 5º percentil de 7,89 a 8,01:1, em 320, 360, 390, 768 e 1280 px, parada e em movimento. Piso do Shield: 7:1. *(auditor)*
- [x] **Redundância:** nenhum estado depende só de cor. A aba ativa tem negrito, ponto cheio e pontilhado. A página não tem mensagens de erro.
- [x] **Scale / Zoom:** sem rolagem lateral em 320, 360, 390, 768 e 1280 px, com e sem o espaçamento de texto do SC 1.4.12. Na página bilíngue, varredura de 320 a 1440 px de 4 em 4 px, nas duas línguas, com a cena rodando e parada: 1124 medições sem rolagem lateral, sem rótulo quebrado e sem a frase encostar nos controles, e 564 com o espaçamento do SC 1.4.12, em que os controles descem para 2 linhas entre 320 e 424 px, e a frase desce junto. A sobreposição de 1024 a 1101 px que o auditor achou com o espaçamento sumiu depois da correção (nota 9). Texto em 200% e zoom de 200% sem estouro. Celular deitado (844 × 390) sem rolagem lateral.
- [x] **Comprimento de linha e ritmo (A11Y.md §4, SC 1.4.8):** texto corrido limitado a 34em, com no máximo 79 caracteres por linha de 320 a 1920 px, inclusive nos três painéis das abas e na faixa escura. O auditor mediu a versão com 35em e achou uma linha de 81 caracteres. A medida foi apertada para 34em e remedida pela IA com os scripts do auditor (essa última medida é autodeclarada). Espaço depois de parágrafo de 2× o corpo (34 px em 17 px, 30 px em 15 px). Texto alinhado à esquerda.
- [~] **Simulador de daltonismo:** não rodado. A paleta é neutra, e os únicos matizes, os chips das categorias das anotações, sempre levam o nome da categoria em texto, e a primeira linha do card repete o tipo.

## 5. Mídia Temporal e Movimento
- [x] **Classificação:** a cena do hero é decorativa, classificação confirmada pelo Felipe em 10/10 (*"a cena é só ambiente do hero, não informa. decorativa."*). A gota e as ondas do clique foram pedidas por ele como enfeite da mesma cena (12/10). Não há vídeo nem áudio.
- [x] **Alternativas:** N/A — sem vídeo e sem áudio. A cena não carrega informação. O nome da marca desenhado no canvas existe em texto no `h1`.
- [~] **Autoplay e Conteúdo em Movimento:**
  - Nenhum áudio.
  - Um botão visível pausa todo o movimento (cena, paralaxe, gota, ondas).
  - Clarões medidos em quadros amostrados:
    - 390 px: pior caso de 2 trocas por segundo em blocos de 6 × 10 px (1 clarão).
    - 768 px: pior caso de 4 trocas por segundo (2 clarões), na gota.
    - Em blocos de 32 × 32 px: 0.
  - Abaixo de 3 por segundo (SC 2.3.1 e 2.3.2).
  - **Falta:** análise com ferramenta certificada (PEAT ou Harding) numa captura real.
- [x] **Movimento Reduzido:** com `prefers-reduced-motion: reduce`, a página abre parada: a cena fica num quadro fixo, sem paralaxe, sem gota e sem ondas no toque. *(auditor, 390, 768 e 1280)*
- [x] **Texto sobre Mídia:** a frase do topo fica sobre uma faixa de papel opaca, com a borda esfumada (`A11Y-DECISIONS.md`). Nenhum pixel escuro da cena a menos de 4 px das letras, em 320, 360, 390, 768 e 1280 px, com a cena parada, em movimento e durante a rolagem. Atrás da caixa do texto, nenhum pixel mais escuro que 0,8× o papel. Contraste das letras na seção 4. *(auditor)* Não testado: num tema real de alto contraste, a faixa some (`forced-colors`), e a frase depende da placa de fundo do navegador sobre o canvas (nota 5).

## 6. Carga Cognitiva e Fluxo
- [x] **Nada para lembrar:** N/A — sem fluxo de etapas, sem autenticação.
- [x] **Nada para redigitar:** N/A — sem formulário.
- [x] **Ajuda no mesmo lugar:** N/A — página única.
- [x] **Espaçamento de texto:** nada cortado nem sobreposto com as substituições do SC 1.4.12, em 320, 360, 390, 768 e 1280 px, nos três estados das abas. O rótulo do botão pode quebrar linha abaixo de 30em. *(auditor)* Na página bilíngue, nada sobreposto de 320 a 1440 px depois da correção da nota 9 (medido de 1 em 1 px entre 1024 e 1120 px).
- [x] **Tempo:** N/A — sem limite de tempo.
- [x] **Necessidades conflitantes:** o foco nos painéis de abas punha em conflito quem navega pelo teclado vendo a tela e quem usa leitor de tela e anda pelo Tab. O Felipe decidiu seguir o padrão oficial (APG), e a decisão está registrada em `A11Y-DECISIONS.md` (nota 2).

---
## 7. Desempenho Funcional
Não preenchido: este relatório não embasa uma declaração formal.

---
## 📝 Notas de Avaliação ou Bloqueios Conhecidos

- **Nota 1 — imagens decorativas (*Image Evidence*, A11Y.md §2).** Confirmadas pelo Felipe em 13/10, depois de ver a regra de `alt` com legenda (HTML §4.8.4.4; tutorial de imagens decorativas do W3C, exemplos 2 e 3). A faixa da identidade do A11Y.md tem `alt=""`, e a legenda diz o texto do selo ("Apoiado pelo Claude for Open Source Program"). As três imagens dos cards de "Como contribuir" têm `alt=""`, porque o título de cada card diz para onde ele leva, e o card do repositório diz "no GitHub" em texto. A imagem parada do hero foi confirmada em 10/10. A legenda e o texto do card mudaram depois da última rodada do auditor, e foram conferidos só pela IA (autodeclarado).
- **Nota 2 — painéis de abas.** Seguem o APG: o painel recebe foco quando o primeiro conteúdo dele não é focável, o que vale para os três. Decisão do Felipe em 13/10 (*"siga o que é recomendado pelos protocolos oficiais"*), depois de uma versão intermediária em que o painel não recebia foco. Conferido pela IA, pelo teclado, depois da última rodada do auditor. Essa verificação é autodeclarada e foi pedida ao auditor (ver o campo de independência).
- **Nota 3 — NBR 17225, nível Pleno.** No Brasil, o Shield corresponde ao nível Pleno (`guide-compliance-profiles` §4): 96 exigências e 50 recomendações, cada recomendação não atendida justificada em `EXCEPTIONS.md`. As recomendações não foram verificadas uma a uma, e o `EXCEPTIONS.md` não existe.
- **Nota 4 — critérios AAA sem verificação:** nível de leitura (SC 3.1.5), palavras incomuns (SC 3.1.3) e pronúncia (SC 3.1.6).
- **Nota 5 — fora do alcance do agente:** leitores de tela, aparelhos reais (houve só emulação do Chromium), Firefox e Safari, controle por voz real e as cores de um tema real de alto contraste (só a geometria do foco foi conferida).
- **Nota 6 — imagem parada entre 450 e ~700 px de largura.** Abaixo de 28,125em, a imagem que aparece antes de a cena carregar (ou sem WebGL) é a composição estreita. Entre 450 e ~700 px, ela mostra a composição larga, enquanto a cena viva já traz os elefantes um pouco para o centro.
- **Nota 7 — histórico.** Esta é a primeira versão do relatório. As 21 publicações anteriores do artefato saíram sem relatório.
- **Nota 8 — avisos do gate.** Os dois avisos de `outline-none` em `pagina/index.html` estão cobertos. O primeiro é `main:focus`, destino do link para pular, que não é controle. O segundo são os botões, abas e cards, que trocam o contorno pelas cantoneiras de 3 px e voltam ao contorno em `forced-colors`. Os outros seis avisos são de `pagina/componentes/`, fora do escopo: quatro de `outline-none` e dois de `guide-coverage` (o formulário e o `select` de amostra, cobertos por `guide-forms` e `guide-form-controls`, guias que esta página não usa).
- **Nota 9 — página bilíngue (13/10).** O idioma vem da escolha salva no botão ou do navegador (`A11Y-DECISIONS.md`, Troca de idioma). A auditoria independente de 13/10 conferiu `lang` em `<html>`, no `[data-lang-root]` e nos trechos de outra língua, nas duas línguas e depois da troca, sem texto de uma língua sobrando na outra (175 e 190 nós de texto e atributos comparados). Ela achou duas falhas, as duas corrigidas no mesmo dia. Uma: com o espaçamento de texto do SC 1.4.12, a frase em inglês ficava sob o botão de idioma de 1024 a 1101 px (🟠). Agora, quando a frase chega a 12 px dos controles, os dois descem para o fluxo. A outra: o dicionário num arquivo à parte bloqueava a leitura do HTML, e as abas esperavam a rede (🟡, *Content Held Hostage*). Agora o dicionário fica dentro da página. As correções foram conferidas rodando de novo os scripts do auditor, pela IA que escreveu o código (autodeclarado). Observações que ficaram: com a letra padrão do navegador em 32 px numa tela de 320 px (cerca de 800% de zoom, além do exigido), a figura das anotações rola de lado, por causa do campo desenhado de 15rem, e isso já acontecia antes; "design system" aparece sem `lang="en"` na página em português, como termo corrente, e isso é decisão do Felipe; num tema real de alto contraste, os controles novos não foram vistos.
- **Nota 10 — antes da primeira publicação no GitHub Pages (13/10).** Duas mudanças conferidas só pela IA que escreveu o código (autodeclarado). A frase do hero é lida inteira pelo leitor de tela: "Deixe seu Figma acessível" / "Make your Figma accessible", num texto `sr-only`, com a parte visual `aria-hidden`. Na árvore de acessibilidade (Chromium), o `banner` tem um parágrafo só com essa frase, nas duas línguas e depois da troca. Antes, o "F" era imagem com nome "Figma" no meio do texto. As fontes passaram a vir com a página (`pagina/fonts/`, licença OFL), no lugar do Google Fonts: servida em `/da11ymd/`, a página carregou as cinco variações do próprio endereço e não fez pedido a outro domínio, nas duas línguas.
- **Nota 11 — skill na Comunidade do Figma e anotações curtas (16/10).** O que mudou:
  - O link para a skill publicada (https://www.figma.com/community/skill/136973/da11y) entrou na introdução e no passo 1 da aba "Como skill", com o mesmo componente de botão-link em nova aba dos outros links da página.
  - A aba passou de três para dois passos. A criação à mão continua no passo 1, como alternativa.
  - A figura das anotações mostra o formato curto do DA11Y.md, com 📢, 🔊 e 🟠. Os textos da introdução da seção e das regras 2 e 4 acompanham, e a legenda explica as marcas.

  O auditor independente aprovou estes nove itens, nas duas línguas:
  - ordem do Tab e foco visível, inclusive com cores forçadas, e o Enter abre o link;
  - nome acessível com o rótulo visível e o aviso de nova aba;
  - alvo de 48 px ou mais de altura, em 1280 e em 320;
  - contraste calculado: `.pin__type` 13.97:1, texto dos cards 11.19:1, chips de 7.32:1 a 7.80:1, rótulo do botão 11.84:1;
  - reflow em 320 e texto a 200% sem perda;
  - `lang` nos termos em inglês;
  - a cor sozinha não carrega significado, porque o nome da categoria está escrito no chip;
  - o conteúdo aparece com JavaScript desligado;
  - gate em PASS.

  Ficaram duas observações:
  - **🔊 com fonte de emoji (LOW).** Com a Noto Color Emoji, o cone escuro do 🔊 fica perto de 1.4:1 contra o fundo do card, embora as ondas cheguem a 8.96:1. O resultado depende da fonte de emoji de quem lê. O texto ao lado diz o mesmo, e o leitor de tela fala o nome do emoji.
  - **"skill" e "script" sem `lang`.** As duas palavras ficam sem `lang` no texto em português, como "skill" já estava antes. A página trata as duas como empréstimos, o que a exceção do SC 3.1.2 cobre.
- **Nota 12 — gravidade em texto (16/10).** Os dois cards de erro da figura das anotações passaram a mostrar a gravidade em cor e em texto, como pede o formato do DA11Y.md: "🟠 HIGH · Aqui: …" e "🟠 HIGH · Biblioteca: …". A legenda explica isso nas duas línguas. A mudança é só de texto, nos mesmos elementos, e foi conferida pela IA que a fez (autodeclarado): os dois cards e a legenda nas duas línguas, sem rolagem horizontal em 320, e o gate em PASS. A gravidade em texto também resolve o que a cor sozinha não dizia a quem não distingue 🔴 de 🟠.
- **Nota 13 — a anotação mostra só o que é lido (16/10).** A legenda da figura das anotações deixou de citar o 🔇, porque o DA11Y.md tirou essa marca: o que não é lido fica fora da anotação e vai para o relatório. A mudança é só de texto, na mesma legenda, nas duas línguas, e foi conferida pela IA que a fez (autodeclarado), com o gate em PASS.
