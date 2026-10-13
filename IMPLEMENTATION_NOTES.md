# Notas de implementação

## Decisões

- O repositório tinha só a direção visual e os SVG. O aplicativo foi criado no lugar, com Tauri 2, React 19, Vite, Dexie, Tiptap 3 e PDF.js 6.
- TypeScript ficou em 5.9.3 porque `typescript-eslint` 8.71 não aceita TypeScript 7.
- O roteamento é `HashRouter` para as janelas secundárias abrirem `index.html` e definirem a rota no hash, sem fallback de SPA.
- `product.json` é a fonte única de nome, versão e identificador.
- O ícone foi gerado a partir de `zenstudies-app-icon.svg` com `@resvg/resvg-js` e `tauri icon`. Não havia PNG ou ICO originais no repositório.
- As referências de tela são os SVG `ZenStudies-direcao-desktop/01-estudio-de-foco.svg`, `02-mesa-modular.svg` e `03-ciclo-imersivo.svg`. Os PNG citados no handoff não estavam no repositório e não foram inventados.
- `src/assets/brand/zenstudies-key-art.png` está no repositório e entra só no primeiro passo do onboarding, com deslocamento máximo de 4 px quando o movimento está completo.
- O símbolo completo aparece na sidebar, no preloader, no onboarding e no cabeçalho da revisão. O cartão de Hoje usa só o núcleo menta.
- A decoração da janela é a nativa do Windows. Os semáforos do mock não foram reproduzidos.
- `@tauri-apps/plugin-fs` foi removido. Arquivos passam pelos comandos Rust limitados à pasta do aplicativo e ao caminho escolhido no diálogo.
- Radix cobre diálogos e tooltips. A paleta e o menu de blocos são listas de botões ancoradas no cursor, porque não nascem de um botão de menu.
- GSAP anima o preloader, a entrada do ciclo, a abertura do inspector, a largura da sidebar e a entrada do diálogo de cartão. Hover e foco ficam no CSS.

## Dependências de sistema

O build do Tauri precisa do linker MSVC e do WebView2. O instalador não declara certificado. O SmartScreen pode avisar justamente porque o pacote não é assinado; isso não é uma reputação configurada no projeto.

## Limitações reais

- Notificações de revisão e de fim de foco só disparam com o processo aberto ou na bandeja. O relógio interno verifica a cada 15 segundos, então o aviso pode atrasar até esse intervalo. Com o aplicativo encerrado, não há notificação.
- “Iniciar com o Windows” existe, começa desligado e usa o plugin de autostart. Não foi verificado num login real do Windows.
- No `npm run dev` sem Tauri, arquivos importados não sobrevivem ao recarregamento. O IndexedDB do navegador também é outro perfil, separado do aplicativo.
- Não há PDF demonstrativo. O conteúdo de exemplo é só texto.
- Substituir um backup grava os arquivos e depois troca o banco. Se a transação do Dexie falhar, os arquivos novos podem já estar na pasta, mas o banco volta ao estado anterior. O backup de segurança em `safety` continua no disco.
- Arrastar um PDF muito grande pela webview manda o arquivo pelo comando de bytes quando o sistema entrega um `File`. O diálogo nativo e o evento de arrastar do Tauri usam o caminho e evitam essa cópia extra.
- Comentário de PDF, criação de nota ou cartão a partir do texto, conflito de edição, backup e lixeira usam diálogos da interface com foco preso. Não há `window.prompt`.
- A limpeza de anexos sem referência só ocorre depois da confirmação em Configurações. Remover o bloco da nota não apaga o arquivo.
- A exportação de um PDF achatado com as marcações não faz parte desta versão.

## Verificação desta sessão

Comandos executados em 12 de outubro de 2026, no Windows, a partir de `C:\Users\Noqy\Desktop\ZenStudies`:

- `npm run lint` saiu com código 0, sem avisos.
- `npm run test` : 13 arquivos, 29 testes, todos passando, em 27,10 s. O Vitest avisou que o jsdom foi criado 13 vezes; isso não é falha.
- `npm run tauri:build` rodou `tsc --noEmit && vite build` antes do Rust. O TypeScript passou. O Vite gerou `dist/` em 2,88 s e avisou três imports dinâmicos que não viram chunk separado (`registry.ts`, `backup.ts`, `pdfjs-dist`). O aviso não interrompeu o build.
- O perfil release do Rust terminou em 3 min 26 s.
- `cargo test --manifest-path src-tauri/Cargo.toml` : 3 testes de armazenamento passaram (`rejects_path_traversal`, `stores_pdf_and_rejects_fake_extension`, `backup_roundtrip_checks_hash`). Código de saída 0.

O pacote gerado neste build inclui o texto “Histórico recente”, conferido no JavaScript de `dist/`.

Instalador, 5.166.080 bytes, gravado em 12/10/2026 23:33:05:

`C:\Users\Noqy\Desktop\ZenStudies\src-tauri\target\release\bundle\nsis\ZenStudies_0.1.0_x64-setup.exe`

Executável:

`C:\Users\Noqy\Desktop\ZenStudies\src-tauri\target\release\zenstudies.exe`

A interface foi medida no Vite em `http://localhost:1420`, com tema claro forçado. Isso não é a janela Tauri.

- 1440×900: sidebar 232 px, inspector 320 px, título de Hoje inteiro, `scrollWidth` 1440.
- 1280×720: sidebar aberta, inspector aberto, sem rolagem horizontal.
- 960×640: sidebar recolhida a 68 px, inspector fechado, sem rolagem horizontal. “Continuar sessão” e “Iniciar foco” ficam visíveis; a captura rápida fica abaixo da dobra.
- Notas em 960 px: o editor termina em 917 px.
- 1920×1080 e 2560 px de largura: sidebar 232 px, sem rolagem horizontal. A coluna do editor permanece em 664 px.

Não alterei a escala do Windows em 125%, 150% e 200%. Também não abri a bandeja, uma notificação nativa nem uma segunda janela Tauri nesta verificação. No `npm run dev`, arquivos binários ficam só em memória e o IndexedDB é o do navegador, separado do aplicativo instalado.

## Próximos passos

- Assinar o instalador quando houver certificado.
- Medir o leitor com PDFs grandes dentro do WebView2.
- Conferir a bandeja, a segunda instância, as notificações nativas e o autostart numa sessão interativa do Windows.
