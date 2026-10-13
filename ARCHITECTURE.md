# Arquitetura

O frontend nunca chama Dexie, o disco ou o Tauri a partir de um componente. A interface usa `StudyServices`. Os comandos do sistema passam por `DesktopGateway`.

## Camadas

- `src/domain`: modelos, revisão, backup, sanitização, arquivos e atalhos. Sem interface e sem banco.
- `src/application`: autosave, dados demonstrativos e casos de uso em `services.ts`.
- `src/repositories`: contrato `StudyRepository` e implementação Dexie.
- `src/desktop`: `TauriGateway` no aplicativo e `MemoryGateway` nos testes e no Vite solto.
- `src/features`: Hoje, Notas, Revisões, Biblioteca, PDFs, Configurações, Onboarding e Captura.
- `src/ui`: símbolo, estilos e diálogos.
- `src-tauri`: janela, bandeja, instância única, armazenamento e backup em zip.

## Schema

O banco IndexedDB se chama `zenstudies`. A versão 2 acrescenta o índice `revision` em notas e preenche `revision = 1` nas entidades que ainda não tinham o campo.

Tabelas: `subjects`, `notes`, `drafts`, `links`, `cards`, `reviewEvents`, `reviewSessions`, `focusSessions`, `attachments`, `pdfs`, `annotations`, `trash`, `meta`.

Toda entidade persistida tem `id`, `createdAt` e `updatedAt`. O que pode ir para a lixeira também tem `deletedAt` e `revision`. Operações que mudam várias tabelas usam `repository.transaction`.

Conteúdo demonstrativo usa `origin: "demo"` e pode ser apagado sem remover o que tem `origin: "user"`.

## Salvamento

O editor espera 600 ms depois da última alteração. A fila `AutosaveQueue` é serial por nota: uma gravação que ainda não começou é descartada se chegar uma mais nova; uma gravação já iniciada termina, e a seguinte grava o texto mais recente.

A ordem de escrita é rascunho e depois nota. O rascunho só é apagado quando a nota é gravada. Se `revision` não bate com a base e a gravação não foi forçada, o serviço devolve conflito e o rascunho permanece. Na abertura, um rascunho com `updatedAt` maior e conteúdo diferente oferece restaurar ou descartar.

O estado visível é Salvando…, Salvo agora ou Não foi possível salvar. Fechar ou sair chama `flushAllSaves`. Se a gravação falhar, a janela continua aberta e o texto pode ser copiado.

Excluir uma nota é lógico. O item da lixeira guarda o instantâneo da nota, das conexões, dos cartões e das marcações com o mesmo `deletedAt`. Restaurar devolve esse conjunto. O arquivo de um anexo compartilhado não é apagado junto com o bloco.

## Revisão

O agendador em `src/domain/review/scheduler.ts` não usa aleatoriedade. Um dia vale 86 400 000 ms.

- Cartão novo: intervalo de 1 dia, `nextReviewAt` igual a agora, dificuldade 2,5.
- Ainda não: conta um erro, intervalo de 10 minutos, dificuldade sobe 0,35 (entre 1 e 5).
- Quase: 1 dia na primeira vez; depois `ceil(dias * 1,4)`. Não muda acertos nem erros. Dificuldade sobe 0,15.
- Lembrei: conta um acerto. Intervalo menor que 1 dia vira 1 dia; 1 dia vira 3; depois `round(dias * 2,2)`, com teto de 180 dias. Dificuldade desce 0,25.

A fila do dia inclui cartões `active`, não apagados, com `nextReviewAt` até o fim do dia local. Suspensos e arquivados ficam de fora.

Cada resposta grava um evento imutável com o estado anterior, a resposta, o estado resultante e o horário. “Ainda não” recoloca o cartão uma vez no fim da sessão. A sessão ativa é reaberta em vez de criar outra, então as respostas já gravadas não se repetem.

Trocar o algoritmo significa substituir `applyReview` e `isDueOnLocalDay`. O restante da aplicação fala com o serviço de revisão, não com a fórmula.

Editar a pergunta ou a resposta de um cartão só altera o texto e a revisão do registro. Intervalo, dificuldade, acertos, erros e eventos antigos permanecem. Suspender ou arquivar tira o cartão da fila. Reativar devolve o mesmo agendamento. Excluir um cartão apaga o registro e o retira de uma sessão aberta; os eventos de revisão ficam.

## Foco

O tempo restante vem de `startedAt`, `pausedMs` e `plannedMinutes`, não da quantidade de vezes que o relógio da interface executou. Pausar grava `pausedAt`. Continuar soma esse intervalo em `pausedMs`. Uma sessão antiga sem esses campos é lida como pausa zero.

Só existe uma sessão aberta, em andamento ou pausada. Iniciar de novo devolve a que já existe. O término natural grava `completed` uma única vez e, se as notificações estiverem permitidas, avisa pelo Windows enquanto o processo está aberto. Encerrar manualmente conclui sem esse aviso. Reiniciar zera o relógio da sessão atual.

## Matérias

Renomear atualiza o nome gravado nos cartões. Recolorir usa a paleta do produto. Excluir marca a matéria como apagada e tira o vínculo das notas, dos cartões e dos PDFs. Esses registros, os anexos e o histórico de revisão continuam no banco.

## Arquivos

A importação valida extensão, tamanho, nome e bytes mágicos. O Rust grava o binário em `storage/{attachments|pdfs}/{uuid}.{ext}` e o Dexie guarda metadados, hash e caminho relativo. Caminhos com `..`, barra invertida ou unidade são recusados. `open_managed` só abre um arquivo dentro dessa pasta.

Marcações de PDF ficam na tabela `annotations`, com página, tipo, retângulos ou pontos normalizados entre 0 e 1, texto, comentário, cor da paleta e timestamps. O PDF original não é reescrito.

## Segurança

A CSP permite apenas o próprio aplicativo, IPC do Tauri e workers locais. HTML colado passa pelo DOMPurify. Links aceitam só `http`, `https` e `mailto`. Não há plugin de shell nem acesso amplo ao disco. Os comandos Rust recusam rotas e rótulos de janela fora da lista permitida.

## Janelas

Há uma janela `main` e janelas reais `capture`, `review`, `note-*` e `pdf-*`. Abrir de novo o mesmo rótulo foca a janela existente. O plugin `window-state` persiste geometria. Uma segunda instância do processo foca a principal.

Cada gravação publica um evento no `SyncBus`. A janela de origem atualiza as listas na hora. As outras recebem o mesmo evento pelo `BroadcastChannel` e, no aplicativo, também pelo evento Tauri `app://sync`. O eco da própria origem é ignorado. O `dataEpoch` sobe e as listas recarregam. Se duas janelas editam a mesma nota, a revisão divergente abre a escolha entre manter o texto local, usar a versão salva ou guardar uma cópia.

Fechar uma janela secundária não encerra a principal. O fechamento da principal é interceptado para concluir as gravações. Com “Continuar em segundo plano ao fechar”, a janela se esconde na bandeja. “Sair completamente” encerra o processo.

As notificações usam o plugin nativo e só saem se o usuário as habilitou. Elas dependem do processo estar aberto ou na bandeja.
