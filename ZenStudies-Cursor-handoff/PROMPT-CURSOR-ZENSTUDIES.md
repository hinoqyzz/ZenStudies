# Prompt para o Cursor — frontend ZenStudies

Você é o engenheiro frontend responsável por transformar a identidade e os mockups anexos do ZenStudies em uma aplicação desktop-first funcional, refinada e verificável.

## 1. Antes de alterar qualquer arquivo

1. Inspecione todo o repositório, incluindo `package.json`, lockfile, estrutura de rotas, convenções, componentes e mudanças não commitadas.
2. Preserve a arquitetura e o gerenciador de pacotes existentes quando forem adequados. Não reescreva um projeto funcional apenas para trocar de framework.
3. Localize a pasta de handoff anexada. Ela contém:
   - `assets/brand/zenstudies-symbol.svg`
   - `assets/brand/zenstudies-logo-horizontal.svg`
   - `assets/brand/zenstudies-app-icon.svg`
   - `assets/brand/zenstudies-app-icon.png`
   - `assets/brand/zenstudies-tokens.json`
   - `assets/brand/zenstudies-key-art.png`
   - `references/01-estudio-de-foco.png`
   - `references/02-mesa-modular.png`
   - `references/03-ciclo-imersivo.png`
4. Examine visualmente as três referências antes de implementar. Elas definem hierarquia, composição, densidade e comportamento, mas não são screenshots para serem usados como imagem de fundo.
5. Se algum ativo não estiver disponível, informe exatamente qual está ausente e continue somente com o que puder ser reproduzido com fidelidade. Não redesenhe o logotipo.

## 2. Objetivo

Construir o frontend de alta fidelidade do ZenStudies, um aplicativo pessoal para estudos, anotações e revisões diárias, feito exclusivamente para computador.

O resultado deve ser uma aplicação real e navegável, não uma landing page, apresentação estática ou conjunto de screenshots. A experiência deve funcionar com mouse e teclado, responder bem ao redimensionamento da janela e manter a identidade “Ciclo Calmo”.

## 3. Escopo desta entrega

Implemente:

1. Preloader animado da marca.
2. Shell desktop com sidebar, barra superior e painel contextual recolhível.
3. Tela **Hoje / Estúdio de Foco**.
4. Tela **Notas / Mesa Modular** com editor funcional.
5. Tela **Revisão / Ciclo Imersivo**.
6. Biblioteca simples com lista de matérias e notas.
7. Command palette.
8. Captura rápida.
9. Estados interativos e transições.
10. Dados demonstrativos locais e persistência local suficiente para testar o fluxo.

Não implemente nesta etapa:

- backend, API remota ou banco de dados;
- autenticação, pagamentos ou sincronização em nuvem;
- IA generativa;
- colaboração entre usuários;
- aplicativo móvel;
- wrapper Electron ou Tauri, salvo se o repositório já possuir um;
- métricas falsas, streaks, ranking, pontos, troféus ou gamificação punitiva.

## 4. Stack

Se o repositório já tiver uma stack frontend coerente, preserve-a e adapte as instruções abaixo.

Se for um projeto novo, use:

- React + TypeScript + Vite;
- CSS variables como fonte de verdade dos tokens;
- Tailwind CSS somente se ajudar sem esconder os tokens da marca;
- Radix Primitives para dialog, tooltip, dropdown, tabs e command palette acessíveis;
- Lucide React para ícones funcionais;
- GSAP + `@gsap/react` para o preloader e transições coreografadas;
- Tiptap (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`) para o editor;
- Zustand para estado local simples e persistência;
- React Router para as rotas, se não houver roteador existente;
- Vitest + Testing Library para testes essenciais.

Use versões estáveis compatíveis com o projeto e com o lockfile. Não fixe versões arbitrárias. Instale apenas dependências necessárias.

## 5. Identidade visual obrigatória

Preserve os ativos fornecidos e os seguintes tokens:

```css
:root {
  --zs-paper: #F5F6F0;
  --zs-ink: #101C1A;
  --zs-focus: #6558E8;
  --zs-focus-hover: #5146CF;
  --zs-mint: #73D8B2;
  --zs-surface: #FFFFFF;
  --zs-surface-subtle: #E9EEEA;
  --zs-context: #EDF1EE;
  --zs-text-muted: #52625E;
  --zs-border: #D4DDD8;
  --zs-success: #187A58;
  --zs-warning: #A46210;
  --zs-error: #B93A46;
  --zs-dark-canvas: #07110F;
  --zs-dark-raised: #172825;
}
```

- Manrope para títulos, números e navegação importante.
- Inter para corpo, editor, metadados e controles.
- Grid-base de 8 px e microajustes de 4 px.
- Raios: 10–14 px em controles, 16–20 px em cards e 24–32 px apenas em superfícies protagonistas.
- Use bordas antes de sombras. Sombras somente em overlays, command palette, menus, preview e superfícies temporárias.
- Menta representa foco atual, conexão ou conclusão; limite seu uso para não dominar a tela.
- Violeta representa ação primária, seleção e progresso ativo.
- Tinta estrutura navegação e o modo imersivo.
- O símbolo completo deve aparecer no máximo uma vez por tela funcional. Use fragmentos ou o núcleo quando precisar de um indicador menor.
- Não use livro, cérebro, lótus, lâmpada, checkmark, capelo de formatura ou ilustrações escolares genéricas.
- Não use glassmorphism, brilho neon, blur excessivo, sombras gigantes ou gradientes aleatórios.

## 6. Responsividade desktop

O aplicativo é desktop-only, mas precisa responder ao tamanho da janela e à escala do sistema.

Valide pelo menos:

- 1280 × 720;
- 1440 × 900 como viewport principal;
- 1920 × 1080;
- monitores largos até 2560 px;
- escala de sistema de 125%, 150% e 200%.

Comportamento:

- Sidebar expandida: 210–248 px.
- Sidebar recolhida: 64–72 px.
- Inspector contextual: 296–360 px.
- Texto do editor: largura confortável entre 640 e 760 px.
- Em janelas menores, recolha primeiro o inspector e depois a sidebar.
- Nunca substitua a navegação desktop por barra inferior móvel.
- Não permita overflow horizontal acidental.
- Painéis redimensionáveis são opcionais; painéis recolhíveis são obrigatórios.

## 7. Preloader

Crie um preloader elegante usando o SVG original do símbolo.

Sequência sugerida:

1. Fundo Tinta ocupa toda a janela.
2. O ciclo claro entra pela diagonal superior esquerda, com deslocamento curto e desaceleração suave.
3. O ciclo violeta entra pela diagonal inferior direita.
4. Os dois ciclos se encaixam e o núcleo menta surge com escala de `0.82` para `1`.
5. O wordmark “ZenStudies” aparece com fade e deslocamento vertical de no máximo 8 px.
6. Uma linha discreta ou o próprio núcleo representa o carregamento real dos recursos.
7. O preloader converge para a posição do logo na sidebar e revela o aplicativo.

Regras:

- Duração normal aproximada: 1,4–1,9 segundo quando os recursos já estiverem prontos.
- Nunca segure a interface apenas para completar uma animação longa.
- Evite spinner genérico.
- Toque o preloader completo apenas na primeira abertura da sessão; nas rotas seguintes use transição curta.
- Com `prefers-reduced-motion: reduce`, substitua tudo por um fade de aproximadamente 120–160 ms.
- Implemente com `useGSAP`, `scope` e cleanup correto. Não deixe timelines ou listeners ativos após unmount.

## 8. Arquitetura de telas

### `/today` — Estúdio de Foco

Use `references/01-estudio-de-foco.png` como referência principal.

- Sidebar escura com Hoje, Notas, Revisões, Biblioteca e matérias favoritas.
- Barra superior com título da rota e busca global/command palette.
- Uma única sessão dominante: “Continue de onde parou”.
- Painel contextual à direita com revisões de hoje e atalhos.
- Bloco secundário “Depois do foco”.
- Captura rápida disponível sem sair da tela.
- Conteúdo em português realista, sem lorem ipsum.

Interações:

- “Continuar sessão” abre a nota atual.
- “Iniciar revisão” abre o Ciclo Imersivo.
- Clicar numa matéria filtra notas.
- Sidebar e inspector podem ser recolhidos.
- Cards têm hover discreto, foco visível e pressed perceptível.

### `/notes/:id` — Mesa Modular

Use `references/02-mesa-modular.png`.

- Navegação global à esquerda.
- Lista de notas/matérias na segunda coluna.
- Editor central como elemento dominante.
- Inspector direito com conexões, cartões e propriedades.
- Feedback “Salvando…”, “Salvo agora” e falha simulável.
- Use Tiptap com títulos, parágrafos, listas, negrito, itálico, links, citações e código básico.
- Uma seleção de texto pode virar cartão por bubble menu ou comando.
- `[[` abre busca de notas relacionadas.
- `/` abre menu de blocos.
- Não deixe uma toolbar permanente e pesada no topo.

### `/review` — Ciclo Imersivo

Use `references/03-ciclo-imersivo.png`.

- Fundo Tinta/dark canvas.
- Sidebars ocultas.
- Uma pergunta por vez em superfície Papel.
- Botão “Mostrar resposta”.
- Após revelar: “Ainda não”, “Quase” e “Lembrei”.
- Atalhos `Espaço`, `1`, `2`, `3` e `Esc`.
- Progresso discreto, sem cronômetro ou pressão.
- Conclusão serena: resumo da sessão e opção de voltar à nota.

### `/library`

- Lista ou grid compacto de matérias.
- Busca, filtros simples e contagem de notas.
- Preview contextual sem abrir outra rota quando possível.
- Evite cards gigantes ou capas decorativas repetitivas.

## 9. Command palette e atalhos

Implemente `Ctrl/Cmd + K` com ações:

- ir para Hoje;
- criar nota;
- abrir nota;
- iniciar revisão;
- recolher/abrir sidebar;
- recolher/abrir inspector;
- alternar tema;
- abrir configurações.

Propostas adicionais:

- `Ctrl/Cmd + N`: nova nota;
- `Ctrl/Cmd + Shift + N`: captura rápida;
- `Ctrl/Cmd + R`: abrir revisão somente se não conflitar com o ambiente;
- `Esc`: fechar overlays ou sair do modo imersivo;
- `Space`: preview temporário quando o foco estiver numa lista e não houver campo de texto ativo.

Não dispare atalhos de navegação enquanto o usuário estiver digitando em input, textarea ou editor, salvo atalhos editoriais explícitos.

## 10. Motion e interação

Use GSAP somente onde a coreografia traz significado:

- preloader;
- entrada e saída do Ciclo Imersivo;
- transição entre nota e cartão criado;
- abertura do inspector;
- mudança coordenada de layout ao recolher painéis.

Use CSS para hover, focus, pressed e feedbacks simples.

Tempos de referência:

- hover/focus: 120–140 ms;
- menus e overlays: 160–180 ms;
- painel contextual: 200–240 ms;
- troca de rota: 220–280 ms;
- convergência dos ciclos: 380–460 ms.

Movimento:

- prefira `transform` e `opacity`;
- deslocamentos de interface entre 4 e 12 px;
- nada deve balançar, flutuar continuamente ou perseguir o cursor;
- parallax máximo de 3–4 px apenas no key art de onboarding ou estado vazio;
- não use ScrollTrigger globalmente, não faça smooth-scroll artificial e não fixe seções do editor;
- se usar ScrollTrigger, limite-o a uma visualização longa somente leitura e justifique no código.

Todas as animações devem respeitar `prefers-reduced-motion` e manter a função acessível sem movimento.

## 11. Dados e estado

Crie modelos TypeScript claros para:

- matéria;
- nota;
- conexão entre notas;
- cartão de revisão;
- sessão de revisão;
- preferência de layout e tema.

Use dados de demonstração em português, incluindo Biologia celular, História moderna e Matemática. Persista notas, estado da sidebar, inspector, tema e progresso de revisão localmente. Não finja sincronização remota.

## 12. Acessibilidade

- Use elementos semânticos e botões reais.
- Radix pode cuidar dos padrões complexos de dialog, tooltip, dropdown e foco.
- Todos os ícones precisam de nome acessível quando não houver rótulo visível.
- Crie focus ring violeta visível em todos os controles.
- Não dependa apenas de cor para estado.
- Preserve contraste mínimo WCAG AA.
- Ordem de tabulação deve acompanhar a hierarquia visual.
- Overlays devem prender e devolver foco corretamente.
- O editor e a revisão devem funcionar integralmente por teclado.

## 13. Performance e qualidade

- Evite re-renderizações do editor durante animações.
- Carregue Tiptap e a tela de revisão de forma preguiçosa se isso reduzir o bundle inicial.
- Importe SVGs e imagens como assets; não converta o logo para base64 ou recrie com CSS.
- Não anime propriedades de layout em loops contínuos.
- Não mantenha listeners globais sem cleanup.
- Não deixe warnings no console.
- Não use imagens de referência como plano de fundo da UI.
- Não use placeholders quebrados, textos cortados ou botões sem ação.

## 14. Organização sugerida

Adapte à arquitetura existente, mas mantenha responsabilidades semelhantes:

```text
src/
  app/
  assets/brand/
  components/
    shell/
    command-palette/
    editor/
    review/
    ui/
  features/
    today/
    notes/
    review/
    library/
  hooks/
  stores/
  styles/
    tokens.css
    themes.css
  types/
```

## 15. Verificação obrigatória

Antes de concluir:

1. Execute instalação, lint, typecheck, testes e build usando os scripts do projeto.
2. Corrija erros e warnings causados pela implementação.
3. Teste navegação por mouse e teclado.
4. Teste `prefers-reduced-motion`.
5. Teste redimensionamento em 1280 × 720, 1440 × 900 e 1920 × 1080.
6. Confirme que sidebar e inspector recolhem sem cortar o editor.
7. Confirme que o preloader não reaparece a cada rota.
8. Confirme que atalhos não são disparados enquanto o usuário digita.
9. Confirme que a aplicação funciona depois de recarregar e restaura os dados locais.
10. Compare visualmente cada tela com sua imagem de referência e corrija hierarquia, espaçamento e clipping.

## 16. Entrega

Entregue:

- frontend funcional;
- componentes reutilizáveis e tipados;
- preloader e animações implementados;
- dados locais de demonstração;
- README com instalação, scripts e atalhos;
- arquivo `IMPLEMENTATION_NOTES.md` descrevendo arquitetura, dependências adicionadas, decisões, limitações e próximos passos;
- lista objetiva dos arquivos modificados;
- resultados reais de lint, typecheck, testes e build.

Não declare conclusão se alguma rota estiver apenas como placeholder ou se o build estiver falhando.
