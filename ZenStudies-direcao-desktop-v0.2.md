# ZenStudies — auditoria e direção visual para desktop v0.2

Data: 12 de outubro de 2026  
Status: análise, pesquisa e protótipos conceituais; nenhuma implementação de software iniciada.

## Decisão recomendada

Construir uma única linguagem desktop com três modos complementares:

1. **Estúdio de Foco** para shell, tela Hoje e retomada de sessão.
2. **Mesa Modular** para editor, biblioteca e conexões entre notas.
3. **Ciclo Imersivo** para revisão ativa sem distrações.

Essa composição é mais coerente do que aplicar a mesma densidade e o mesmo tipo de cartão em todas as telas. A identidade “Ciclo Calmo” passa a funcionar como comportamento: o núcleo define o foco atual, a sobreposição representa contexto e conexões, e os ciclos aparecem quando existe continuidade real.

## Premissas

### Confirmadas

- Aplicativo pessoal para estudos, anotações e revisões diárias.
- Uso exclusivamente em computador.
- Nome e identidade visual ZenStudies v0.1 preservados.
- Direção “Ciclo Calmo”, cores e tipografia permanecem como base.

### Reversíveis

- Os protótipos usam uma janela de 1600 × 1000 para demonstrar comportamento em telas comuns.
- A interface é neutra entre Windows e macOS; a tecnologia e o sistema operacional alvo ainda não foram definidos.
- Atalhos apresentados são propostas e precisam de auditoria de conflitos antes da implementação.

## Auditoria da identidade visual existente

| Achado | Tipo | Severidade | Impacto no desktop | Correção proposta |
|---|---|---:|---|---|
| “Ciclo Calmo” traduz continuidade sem clichês educacionais | força | — | fornece linguagem própria para progresso, conexões e revisão | preservar como ideia central |
| Símbolo pode parecer integração ou corrente quando isolado | risco | média | repetição em cartões transforma a marca em decoração genérica | usar o símbolo completo apenas em marca, início de sessão e estados vazios; nos componentes, usar núcleo e fragmentos |
| Exploração anterior foi desenhada como mobile | erro de direção | alta | cartões muito grandes, navegação inferior e baixa densidade desperdiçam a tela | substituir por sidebar persistente, painéis recolhíveis e conteúdo central fluido |
| Key art 3D é mais expressivo que a UI plana | risco | média | misturar 3D nos fluxos diários enfraquece a precisão do editor | reservar 3D para onboarding, marketing e vazios importantes |
| Raios grandes aparecem em muitas superfícies | risco | média | tudo vira “soft UI” e perde hierarquia | 12–14 px em controles, 16–20 px em cartões, 24–32 px apenas em superfícies protagonistas |
| Paleta é forte e os pares principais têm bom contraste | força | — | permite shell escuro e área de leitura clara | limitar menta a cerca de 10% da tela e usar violeta para ação/seleção |
| Tokens ainda não cobrem produto desktop | lacuna | alta | faltam painéis, overlays, estados, resize, foco e tema escuro | criar extensão de tokens antes do desenvolvimento |
| Manrope + Inter são legíveis, mas não diferenciam sozinhas | oportunidade | baixa | a marca pode parecer um SaaS comum | diferenciação deve vir do ritmo espacial, do uso do núcleo e das transições, não de efeitos tipográficos |

## Pesquisa de referências

As referências abaixo orientam comportamento e organização. Não devem ser copiadas visualmente.

### Craft — Hoje como ponto de retorno

O Calendar reúne nota diária, tarefas e eventos e permite ocultar o que não interessa. Para ZenStudies, “Hoje” deve reunir somente retomada, revisões devidas e captura rápida. O suporte recente a abas e modo de foco no Windows reforça que um produto desktop pode alternar entre multitarefa e escrita sem distrações.  
Fontes: [Craft Calendar](https://support.craft.do/hc/en-us/articles/6778959743005-Event-Notes) e [Craft 3.3.7 — Windows tabs e focus mode](https://www.craft.do/zh-CN/blog/craft-update-3-3-7).

### Capacities — contexto em painel lateral

No desktop, uma nota diária pode ser aberta em painel lateral com `Shift + clique`, e a visualização do dia usa abas e sidebar contextual. Para ZenStudies, conexões, cartões e propriedades devem aparecer à direita sem substituir a nota atual.  
Fonte: [Capacities — Dates and daily notes](https://docs.capacities.io/reference/dates-and-daily-notes).

### Readwise Reader — teclado e foco localizado

O Reader oferece command palette, navegação por teclado, anotações na margem e painéis laterais recolhíveis. Para ZenStudies, leitura, seleção, criação de cartão e navegação devem funcionar sem depender do mouse.  
Fontes: [Readwise Reader — Basics](https://docs.readwise.io/reader/docs/faqs) e [Highlights, Tags and Notes](https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes).

### RemNote — nota e revisão no mesmo fluxo

O RemNote combina menu `/`, omnibar, referências digitadas e criação de flashcards no editor. Também oferece captura rápida no aplicativo desktop. A oportunidade do ZenStudies é manter essa continuidade com menos sintaxe visível e menor carga técnica.  
Fontes: [RemNote — Keyboard Shortcuts](https://help.remnote.com/en/articles/7893440-keyboard-shortcuts) e [RemNote — Quick Add](https://help.remnote.com/en/articles/14499461-quick-add).

### Obsidian — painéis e backlinks

O Obsidian usa sidebars esquerda e direita, painéis fixáveis e backlinks contextuais. ZenStudies pode aproveitar a arquitetura de três áreas, mas deve impedir que o usuário transforme o aplicativo em uma grade caótica de painéis.  
Fontes: [Obsidian — Sidebar](https://obsidian.md/help/sidebar) e [Obsidian — Backlinks](https://obsidian.md/help/plugins/backlinks).

### Linear — preview e comandos rápidos

O “Peek” permite visualizar detalhes sem abandonar a lista e funciona com teclado. Em ZenStudies, segurar `Espaço` ou usar uma ação equivalente pode pré-visualizar nota, cartão ou referência sem quebrar o foco do editor.  
Fonte: [Linear — Peek preview](https://linear.app/docs/peek).

## Arquitetura visual desktop

```text
┌────────────────────────────────────────────────────────────────────┐
│ barra da janela / abas / busca global                              │
├──────────────┬───────────────────────────────┬─────────────────────┤
│ navegação    │ área de trabalho             │ contexto            │
│ 210–248 px   │ fluida, foco principal       │ 296–360 px          │
│ recolhível   │ editor / hoje / biblioteca   │ conexões / cartões  │
└──────────────┴───────────────────────────────┴─────────────────────┘
```

- **Sidebar principal:** Hoje, Notas, Revisões, Biblioteca e matérias favoritas.
- **Área central:** nunca deve competir com mais de uma superfície dominante.
- **Painel contextual:** muda conforme a seleção; pode ser fechado e lembrado por usuário.
- **Command palette:** `Ctrl/Cmd + K` como porta de entrada para comandos e navegação.
- **Captura rápida:** proposta `Ctrl/Cmd + Shift + N`, inclusive a partir de outra tela do app.
- **Abas:** úteis para comparar duas notas ou manter um PDF junto ao editor; limitar abertura automática.
- **Preview temporário:** abre sem perder seleção e fecha com `Esc`.

## Direção 1 — Estúdio de Foco

Arquivo: `ZenStudies-direcao-desktop/01-estudio-de-foco.png`

**Tese:** o início responde imediatamente “qual é a melhor próxima ação?”.

- Sidebar Tinta cria uma âncora estável.
- Área Papel concentra uma única sessão dominante.
- Painel direito reúne revisões e atalhos, sem transformar a tela em dashboard.
- O símbolo completo aparece apenas no foco atual.
- Melhor rota para o shell e para o primeiro MVP.

**Risco:** o cartão escuro perde força se for repetido em todas as páginas. Reservá-lo para retomada e estados importantes.

## Direção 2 — Mesa Modular

Arquivo: `ZenStudies-direcao-desktop/02-mesa-modular.png`

**Tese:** escrever é a atividade central; organização e revisão orbitam a nota.

- Coluna esquerda seleciona notas e matérias.
- Editor central mantém largura de leitura confortável.
- Painel direito mostra conexões, cartões e propriedades da seleção.
- Um trecho pode virar cartão sem abrir uma página separada.
- Bordas substituem sombras nas superfícies permanentes.

**Risco:** quatro áreas visuais podem ficar densas em telas menores. A lista de notas e o painel contextual devem recolher independentemente.

## Direção 3 — Ciclo Imersivo

Arquivo: `ZenStudies-direcao-desktop/03-ciclo-imersivo.png`

**Tese:** revisão é um estado temporário, curto e sem distrações.

- Sidebars desaparecem e a pergunta ocupa o centro.
- Progresso existe, mas não há cronômetro, ranking ou ameaça de sequência.
- A resposta é revelada com uma ação explícita.
- Avaliação usa “Ainda não”, “Quase” e “Lembrei”, com atalhos numéricos.
- O fundo escuro diferencia revisão do trabalho editorial sem criar um segundo produto.

**Risco:** não transformar todo o app em dark mode por causa desta tela. O contraste é intencional para marcar mudança de modo.

## DNA visual para implementação

### Estrutura

- Grid-base: 8 px; microajustes em 4 px.
- Barra superior: 52–60 px.
- Sidebar: 210–248 px; versão recolhida: 64–72 px.
- Inspector: 296–360 px.
- Largura ideal do texto: 640–760 px.
- Padding de página: 32–48 px.

### Raios e elevação

- Campos e botões: 10–14 px.
- Cards comuns: 16–20 px.
- Superfície protagonista: 24–32 px.
- Pills apenas para tags, filtros e atalhos compactos.
- Sombras somente em command palette, menus, modais, preview e superfícies temporárias.

### Cores adicionais de superfície

| Token | Valor | Função |
|---|---:|---|
| `desktop.chrome` | `#DDE5E0` | fundo externo e moldura |
| `desktop.sidebar` | `#101C1A` | navegação persistente |
| `desktop.canvas` | `#FFFFFF` | editor e leitura |
| `desktop.context` | `#EDF1EE` | painéis auxiliares |
| `desktop.selection` | `#F0EEFF` | seleção e trecho ativo |
| `desktop.darkCanvas` | `#07110F` | ambiente do modo revisão |
| `desktop.focusRing` | `rgba(101,88,232,.32)` | foco de teclado |

### Tipografia

- Título de página: Manrope 650–750, 28–42 px.
- Título de nota: Manrope 700–760, 36–44 px.
- Corpo do editor: Inter 16–18 px, entrelinha 1,55–1,7.
- Interface: Inter 13–15 px.
- Metadados: 12–13 px, contraste preservado.

### Motion

- Hover e foco: 140 ms.
- Abrir painel contextual: 220 ms, deslocamento de 8 px.
- Trocar cartão de revisão: 220 ms, sem flip 3D.
- Entrar no Ciclo Imersivo: 420 ms com fechamento suave das laterais.
- Respeitar redução de movimento; nenhuma informação depende de animação.

## Estados que precisam ser desenhados antes de programar

1. Vazio inicial sem matérias ou notas.
2. Salvamento local, sincronizando, salvo e falha de salvamento.
3. Busca sem resultado e resultado parcial.
4. Nota longa com imagens, tabela, código e fórmulas.
5. Painéis recolhidos em 1280 × 720.
6. Escala de sistema em 125%, 150% e 200%.
7. Foco de teclado, hover, pressed, selected e disabled.
8. Revisão sem cartões, sessão pausada e sessão concluída.
9. Modo claro, escuro e preferência do sistema.
10. Recuperação de nota após fechamento inesperado.

## Prompt refinado — sistema desktop completo

```text
Use case: ui-mockup
Asset type: production-quality desktop application interface for ZenStudies
Canvas: 1600 × 1000, desktop window without device mockup
Primary request: design a calm, keyboard-first study workspace that combines daily focus, connected notes and active recall without looking like a mobile layout stretched to desktop
Architecture: persistent dark left sidebar, flexible central workspace, optional right contextual inspector, top global command/search area, collapsible panels and realistic window resizing behavior
Brand invariants: preserve the exact ZenStudies Ciclo Calmo symbol; deep ink #101C1A, focus violet #6558E8, fresh mint #73D8B2, warm paper #F5F6F0; Manrope-like headings and Inter-like reading text
Visual behavior: use the mint core for current focus and connections, violet for selection and primary actions, ink for structure, and the full cycle symbol only in important brand or session moments
Content: realistic Portuguese labels for Hoje, Notas, Revisões and Biblioteca; one dominant action per screen; keyboard shortcut hints where useful
Constraints: desktop only; no bottom navigation; no giant mobile cards; no analytics dashboard; no streak pressure; no trophies; no glassmorphism; no excessive shadows; no decorative repetition of the logo; no book, brain, lotus, checkmark or graduation cap
QA criteria: clear hierarchy in five seconds, readable text, panels that can collapse, visible keyboard focus, no clipped labels, no text inside generated decorative imagery
```

## Recomendação de sequência

1. Aprovar ou ajustar estes três modos visuais.
2. Definir o sistema operacional e a tecnologia do aplicativo.
3. Criar um protótipo clicável com Hoje → Editor → Criar cartão → Revisão.
4. Validar o fluxo em 1280 × 720, 1440 × 900 e 1920 × 1080.
5. Fechar tokens desktop, tema escuro e biblioteca de componentes.
6. Somente então iniciar a implementação.

## Critérios de aceite para o protótipo

- Em até cinco segundos, fica claro o que continuar e onde criar uma nota.
- Todas as ações essenciais podem ser alcançadas por teclado.
- A nota continua sendo o elemento principal quando o inspector está aberto.
- O símbolo completo não aparece mais de uma vez por tela funcional.
- Revisão não usa culpa, contagem regressiva ou recompensa infantil.
- O layout permanece utilizável em 1280 × 720 e com escala de 150%.
- O usuário consegue fechar qualquer painel auxiliar e recuperar o estado anterior.
