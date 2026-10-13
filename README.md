# ZenStudies

Aplicativo de estudos para Windows. Notas, cartões de revisão, leitura de PDF e sessões de foco ficam neste computador. Não há conta, servidor nem sincronização em nuvem.

A identidade visual (nome, versão, identificador e título) está em `product.json`. O script `npm run sync-product` copia a versão para `package.json` e `src-tauri/tauri.conf.json`.

## Pré-requisitos

- Node.js 22 ou mais recente, com npm
- Rust estável com o alvo MSVC do Windows (este ambiente usou Rust 1.93)
- Visual Studio Build Tools com o toolchain C++ para o `link.exe`
- WebView2. O instalador NSIS usa o bootstrapper da Microsoft se o runtime ainda não estiver na máquina; essa etapa precisa de rede na instalação

Não é necessário privilégio de administrador. A instalação é por usuário (`currentUser`). O instalador não é assinado.

## Instalação a partir do código

```powershell
npm install
npm run sync-product
```

## Desenvolvimento

O produto abre numa janela Tauri, não no navegador:

```powershell
npm run tauri:dev
```

`npm run dev` sobe só o Vite na porta 1420. Nesse modo o armazenamento de arquivos é em memória e some ao recarregar. Os dados duráveis são os da janela Tauri.

## Build

```powershell
npm run tauri:build
```

O alvo configurado é o instalador NSIS. O executável fica em `src-tauri/target/release/zenstudies.exe`. O `setup.exe` fica em `src-tauri/target/release/bundle/nsis/`.

## Onde ficam os dados

No Windows, a pasta de dados do aplicativo é `%APPDATA%\com.zenstudies.desktop`.

- `storage/attachments` e `storage/pdfs`: imagens, áudios e PDFs copiados com nome interno
- `safety`: backup automático criado antes de substituir os dados
- IndexedDB `zenstudies`: matérias, notas, rascunhos, cartões, sessões, marcações e lixeira, no perfil do WebView2
- `localStorage` (`zenstudies.preferences`): tema, largura de leitura, movimento, bandeja e confirmação do preloader

PDFs e anexos não entram na nota como base64.

## Atalhos

| Atalho | Ação |
| --- | --- |
| Ctrl+K | Paleta de comandos |
| Ctrl+N | Nova nota |
| Ctrl+Shift+N | Captura rápida |
| Ctrl+O | Importar PDF |
| Esc | Fecha overlay ou sai da revisão |
| Espaço | Pré-visualiza o item focado numa lista; na revisão, mostra a resposta |
| 1, 2, 3 | Ainda não, Quase, Lembrei, depois da resposta |
| Ctrl+B, Ctrl+I | Negrito e itálico no editor |

Atalhos globais não disparam enquanto o foco está num campo, no editor ou durante composição por IME. Ctrl+K continua disponível na própria paleta.

## Backup

Em Configurações:

1. **Exportar** abre o diálogo nativo e grava um `.zenbackup` (zip versionado).
2. **Importar** valida formato, versão e hashes antes de mudar qualquer coisa.
3. **Mesclar** acrescenta registros cujo id ainda não existe.
4. **Substituir** pede confirmação, grava antes um backup em `safety` e só então troca os dados.

O pacote inclui manifesto, dados estruturados, anexos, PDFs, marcações e preferências relevantes. Rascunhos não entram no backup.

## Fontes

Inter e Manrope vêm dos pacotes `@fontsource`, licenciados sob a SIL Open Font License. O aplicativo não baixa fontes em tempo de execução.
