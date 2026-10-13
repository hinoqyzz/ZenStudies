# ZenStudies — auditoria da identidade e direção visual do aplicativo

Data da análise: 12 de outubro de 2026  
Status: pesquisa e exploração visual; nenhuma implementação iniciada.

## Decisão recomendada

Usar **Foco do Dia** como linguagem-base da tela inicial e do shell do produto. Usar **Mesa de Estudo** como linguagem do editor e **Ciclo Vivo** apenas dentro da experiência de revisão. Assim, cada parte da identidade ganha uma função: o núcleo é o foco, a sobreposição conecta notas e os ciclos comunicam revisão e retomada.

## Auditoria da identidade visual

### O que já está forte

- **Conceito coerente:** “Ciclo Calmo” traduz estudo recorrente sem recorrer a livro, cérebro, lâmpada, lótus ou gamificação escolar.
- **Símbolo extensível:** os módulos sobrepostos funcionam como ícone, indicador de progresso, marcador de conexão e base de motion.
- **Paleta reconhecível:** Tinta, Foco Violeta, Menta e Papel equilibram serenidade e energia. Os pares principais já medidos atendem WCAG AA para texto normal.
- **Tipografia adequada:** Manrope cria presença em títulos; Inter sustenta leitura prolongada e interface.
- **Voz correta:** clara e encorajadora sem pressão, culpa ou linguagem de produtividade extrema.
- **Boa restrição de marca:** as proibições são específicas e reduzem o risco de cair em uma identidade genérica de educação ou wellness.

### Riscos encontrados

1. **Símbolo abstrato demais quando isolado.** Sem contexto, pode ser lido como corrente, integração ou SaaS genérico. A interface deve ensinar seu significado por comportamento: conectar, retomar e revisar.
2. **Excesso de repetição do logo.** O símbolo não deve aparecer inteiro em todos os cartões. Usar fragmentos, caminhos e núcleos funcionais.
3. **Key art tridimensional distante da UI plana.** Funciona para lançamento e onboarding, mas não deve definir componentes cotidianos.
4. **Raios grandes em excesso.** Se toda superfície for arredondada e flutuante, o produto perde hierarquia e vira “soft UI” genérica.
5. **Sistema incompleto para produto.** Faltam tokens de modo escuro, estados pressed/disabled/loading, seleção de texto, realces, superfícies de editor, overlays e elevação por plataforma.
6. **A tela inicial conceitual ainda parece apresentação de marca.** O produto real deve priorizar retomada, escrita e revisão com menos decoração.

## Como transformar a marca em comportamento

| Elemento da marca | Uso funcional no produto |
|---|---|
| Núcleo menta | foco atual, cursor de conexão, estado concluído sem celebração excessiva |
| Ciclo Tinta | conteúdo já percorrido, sessão iniciada, contexto estável |
| Ciclo Violeta | próximo passo, progresso ativo, seleção e CTA |
| Sobreposição | relação entre notas, origem de um cartão e backlinks |
| Espaço central | uma tarefa por vez, leitura confortável e redução de ruído |
| Movimento convergente | abrir sessão, reunir materiais e voltar ao ponto anterior |

## Referências pesquisadas e o que aproveitar

As referências abaixo orientam padrões, não aparência para copiar.

### Craft

O Calendar reúne nota diária, tarefas e eventos no mesmo contexto, reduzindo troca de telas. Para ZenStudies, a lição é fazer “Hoje” funcionar como ponto de retorno, não como dashboard.  
Fonte oficial: [Craft — Calendar](https://support.craft.do/hc/en-us/articles/6778959743005-Event-Notes)

### Capacities

Trata tempo e nota diária como eixos estruturais e permite abrir a nota do dia em painel lateral. Para ZenStudies, isso inspira uma nota diária que acompanha a sessão sem substituir o conteúdo principal.  
Fonte oficial: [Capacities — Dates and daily notes](https://docs.capacities.io/reference/dates-and-daily-notes)

### Readwise Reader

Usa foco por parágrafo, atalhos de teclado e anotações na margem para preservar a leitura. Também oferece temas de leitura separados do restante da interface. Para ZenStudies, isso indica editor e leitura com superfícies configuráveis, foco localizado e ferramentas que aparecem somente quando necessárias.  
Fontes oficiais: [Highlights, Tags and Notes](https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes) e [Appearance](https://docs.readwise.io/reader/docs/faqs/appearance)

### RemNote

Integra cartões diretamente às notas e mostra apenas o material devido na fila de revisão. A oportunidade para ZenStudies é preservar essa continuidade com uma interface mais simples e menos técnica. A marca também deve evitar transformar sequência diária em punição.  
Fontes oficiais: [Flashcards in your notes](https://www.remnote.com/feature/flashcards-in-your-notes) e [Getting Started with Spaced Repetition](https://help.remnote.com/en/articles/6022755-getting-started-with-spaced-repetition)

### Superlist

Trata listas como documentos ricos que misturam texto, tarefas e mídia. Para ZenStudies, isso apoia blocos de nota flexíveis, mas o modelo deve permanecer orientado a aprendizagem, não a gestão de equipe.  
Fonte oficial: [Superlist basics](https://help.superlist.com/en/articles/10050-superlist-basics-lists-tasks-sections-meetings-explained)

## Arquitetura visual recomendada

### Navegação principal

1. **Hoje** — retomar sessão, capturar nota e enxergar revisões devidas.
2. **Notas** — editor, conexões, tópicos e busca.
3. **Revisões** — fila de recordação ativa e histórico discreto.
4. **Biblioteca** — matérias, fontes, anexos e coleções.

No mobile, mostrar no máximo três destinos fixos; Biblioteca pode ficar em “Mais” durante o MVP. No desktop, usar sidebar compacta e recolhível.

### Tela Hoje

- Um único foco dominante.
- Botão primário contextual: “Começar sessão”, “Continuar escrevendo” ou “Iniciar revisão”.
- No máximo dois blocos de apoio.
- Progresso representado por percurso, não por gráfico de produtividade.
- Sem pontos, troféus, ranking ou ameaça de perder sequência.

### Editor

- Página contínua, largura confortável e toolbar contextual.
- Transformar trecho em cartão sem mudar de aplicativo.
- Mostrar conexões na margem ou em painel deslizante.
- Menta marca relações; violeta marca seleção e ação.
- Salvamento automático com feedback preciso e discreto.

### Revisão

- Uma pergunta por tela.
- Resposta revelada sob ação explícita.
- Avaliação humana: “Ainda não”, “Quase” e “Lembrei”.
- Ciclos da marca mostram progresso da sessão, sem porcentagem agressiva.
- Erros são esperados e não recebem vermelho punitivo.

## Três propostas visuais

### 1. Foco do Dia

Arquivo: `ZenStudies-conceitos-visuais/01-foco-do-dia.png`

**Tese:** a tela inicial deve responder “qual é a melhor próxima ação?”.  
**Força:** hierarquia imediata, bom ponto de partida para MVP e fácil adaptação ao desktop.  
**Risco:** o cartão escuro pode ficar pesado se repetido em outras telas.  
**Uso recomendado:** shell, tela Hoje e retomada de sessão.

### 2. Mesa de Estudo

Arquivo: `ZenStudies-conceitos-visuais/02-mesa-de-estudo.png`

**Tese:** a nota diária é a superfície central; revisão nasce do que foi escrito.  
**Força:** aproxima o produto de um espaço pessoal e diferencia ZenStudies de apps de flashcard.  
**Risco:** a grande área vazia precisa de bons estados iniciais e comandos de edição.  
**Uso recomendado:** editor, nota diária e criação de conexões.

### 3. Ciclo Vivo

Arquivo: `ZenStudies-conceitos-visuais/03-ciclo-vivo.png`

**Tese:** revisar é um ritual curto e visualmente contínuo.  
**Força:** usa o símbolo como componente funcional e cria uma experiência memorável.  
**Risco:** o motivo gráfico perde força se estiver presente em todas as telas.  
**Uso recomendado:** início e conclusão de uma sessão de revisão.

## Visual DNA proposto

- Grid: 4 px para microajustes; 8 px para composição.
- Margem mobile: 20–24 px.
- Corpo: 15–16 px; entrelinha de 1,45–1,6.
- Títulos: Manrope 650–750, tracking levemente negativo.
- Raio de campos: 12–14 px; superfícies dominantes: 20–24 px; pills somente para filtros e ações compactas.
- Bordas antes de sombras; sombras apenas para menus, modais e elementos temporários.
- Menta: até 10% da tela; violeta: ação e seleção; Tinta: estrutura; Papel: superfície principal.
- Ilustrações 3D: onboarding, vazio significativo e marketing; nunca atrás de texto longo.
- Motion: 140 ms para feedback, 220 ms para transição local, 420 ms para convergência dos ciclos; respeitar redução de movimento.

## Prompts refinados para as próximas telas

### Tela Hoje

```text
Use case: ui-mockup
Asset type: mobile home screen for ZenStudies, 390 x 844
Primary request: a calm daily study home that presents one dominant next action, then one compact review list and one capture shortcut
Style: production-quality mobile UI, editorial minimalism, warm paper surface, strong Manrope-like headings and readable Inter-like body
Palette: #101C1A, #6558E8, #73D8B2, #F5F6F0
Brand behavior: use the offset rounded-square cycles as a functional progress or resume cue, not as repeated decoration
Constraints: no device frame, no OS chrome, no analytics dashboard, no nested cards, no streak pressure, no book, brain, lotus, checkmark or graduation cap
```

### Editor

```text
Use case: ui-mockup
Asset type: ZenStudies mobile note editor, 390 x 844
Primary request: a distraction-light continuous writing surface where a selected passage can become a review card and connect to another note without leaving the editor
Hierarchy: document title, readable body, contextual selection toolbar, subtle connection rail, save state
Palette and type: preserve the approved ZenStudies tokens and typography
Constraints: no permanent formatting toolbar, no card pile, no fake paper texture, no copied editor chrome, no decorative logo repetition
```

### Revisão

```text
Use case: ui-mockup
Asset type: ZenStudies active-recall screen, 390 x 844
Primary request: one question at a time, answer reveal, calm three-choice self-rating, and a brand-derived cycle showing session progress
Text: “Mostrar resposta”, “Ainda não”, “Quase”, “Lembrei”
Palette and type: preserve the approved ZenStudies tokens and typography
Constraints: no red punishment state, no timer pressure, no streak, no trophies, no confetti, no percentage-heavy dashboard
```

## Pendências antes da implementação

- Definir plataforma inicial: mobile nativo, desktop ou web responsivo.
- Escolher a direção-base entre os três conceitos.
- Desenhar os estados de editor e revisão a partir da direção selecionada.
- Criar tema escuro e tokens de interação.
- Testar logo em 16, 20, 24 e 48 px.
- Validar o fluxo com tarefas reais antes de expandir o escopo.
