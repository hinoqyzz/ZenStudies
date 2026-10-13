import { documentFromText } from "../domain/content";
import { createId } from "../domain/ids";
import type { Card, Note, NoteLink, Subject } from "../domain/models";
import { newCardSchedule } from "../domain/review/scheduler";

export interface DemoDataset {
  subjects: Subject[];
  notes: Note[];
  links: NoteLink[];
  cards: Card[];
}

export function buildDemoDataset(now = new Date()): DemoDataset {
  const createdAt = now.toISOString();
  const biologyId = createId();
  const historyId = createId();
  const mathId = createId();
  const mitoId = createId();
  const krebsId = createId();
  const industrialId = createId();
  const quadraticId = createId();
  const subjects: Subject[] = [
    subject(biologyId, "Biologia celular", "#6558E8", createdAt),
    subject(historyId, "História moderna", "#E0B56D", createdAt),
    subject(mathId, "Matemática", "#73D8B2", createdAt),
  ];
  const notes: Note[] = [
    note(mitoId, biologyId, "Mitocôndrias e produção de energia", biologyText, createdAt, true),
    note(krebsId, biologyId, "Ciclo de Krebs", krebsText, createdAt, false),
    note(industrialId, historyId, "Revolução Industrial", historyText, createdAt, false),
    note(quadraticId, mathId, "Funções quadráticas", mathText, createdAt, false),
  ];
  const links: NoteLink[] = [
    {
      id: createId(),
      fromNoteId: mitoId,
      toNoteId: krebsId,
      source: "manual",
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      revision: 1,
      origin: "demo",
    },
  ];
  const schedule = newCardSchedule(now);
  const cards: Card[] = [
    card(mitoId, biologyId, "Biologia celular", "Qual é a principal função da membrana interna da mitocôndria?", "Abrigar a cadeia respiratória e a ATP sintase, permitindo a produção de ATP.", createdAt, schedule),
    card(mitoId, biologyId, "Biologia celular", "O que a mitocôndria disponibiliza para a célula?", "Energia utilizável na forma de ATP, obtida a partir de nutrientes.", createdAt, schedule),
    card(industrialId, historyId, "História moderna", "Que mudança a máquina a vapor ajudou a acelerar?", "A passagem da produção artesanal para a fábrica, com nova organização do trabalho e das cidades.", createdAt, schedule),
    card(quadraticId, mathId, "Matemática", "O que o discriminante indica em uma função quadrática?", "A quantidade de raízes reais: positivo, duas; zero, uma; negativo, nenhuma.", createdAt, schedule),
  ];
  return { subjects, notes, links, cards };
}

function subject(id: string, name: string, color: string, createdAt: string): Subject {
  return { id, name, color, createdAt, updatedAt: createdAt, deletedAt: null, revision: 1, origin: "demo" };
}

function note(id: string, subjectId: string, title: string, text: string, createdAt: string, pinned: boolean): Note {
  const content = documentFromText(text);
  return {
    id,
    subjectId,
    title,
    content,
    text,
    pinned,
    status: "studying",
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    revision: 1,
    origin: "demo",
  };
}

function card(
  noteId: string,
  subjectId: string,
  subjectName: string,
  question: string,
  answer: string,
  createdAt: string,
  schedule: ReturnType<typeof newCardSchedule>,
): Card {
  return {
    id: createId(),
    noteId,
    subjectId,
    subjectName,
    question,
    answer,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    revision: 1,
    origin: "demo",
    sourcePdfId: null,
    sourcePage: null,
    sourceAnnotationId: null,
    ...schedule,
  };
}

const biologyText = `A mitocôndria transforma nutrientes em energia utilizável pela célula. Esse processo produz ATP em etapas conectadas.

A cadeia respiratória ocorre na membrana interna. Os elétrons passam por complexos proteicos e ajudam a formar um gradiente de prótons.

ATP sintase usa esse gradiente para fosforilar ADP. Sem essa organização de membrana, a célula perderia a maior parte do rendimento energético.

O ciclo de Krebs acontece na matriz e fornece elétrons para a cadeia. As duas etapas se explicam melhor quando lidas juntas.`;

const krebsText = `O ciclo de Krebs oxida grupos acetil e libera CO2. Ao mesmo tempo, produz NADH e FADH2, que seguem para a cadeia respiratória.

Ele não entrega a maior parte do ATP diretamente. Sua importância está na conexão com o transporte de elétrons na mitocôndria.`;

const historyText = `A Revolução Industrial reorganizou o trabalho, a energia e o espaço urbano entre os séculos XVIII e XIX. A máquina a vapor permitiu fábricas maiores e menos dependentes dos rios.

Famílias migraram para cidades industriais, onde a jornada, o salário e a moradia passaram a ser disputas políticas. Ler o período exige olhar técnica e vida cotidiana ao mesmo tempo.`;

const mathText = `Uma função quadrática tem a forma f(x) = ax² + bx + c, com a diferente de zero. O gráfico é uma parábola.

O discriminante Δ = b² − 4ac indica quantas raízes reais a equação possui. O vértice concentra o valor máximo ou mínimo da função.`;
