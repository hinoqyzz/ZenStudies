import { useState } from "react";
import { useApp } from "../../app/context";
import type { Card, CardState } from "../../domain/models";
import { ConfirmDialog } from "../../ui/components";

const FILTERS: { id: "all" | CardState; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Ativos" },
  { id: "suspended", label: "Suspensos" },
  { id: "archived", label: "Arquivados" },
];

const STATE_LABEL: Record<CardState, string> = {
  active: "Ativo",
  suspended: "Suspenso",
  archived: "Arquivado",
};

function intervalLabel(card: Card): string {
  const names = {
    days: card.currentInterval === 1 ? "dia" : "dias",
    hours: card.currentInterval === 1 ? "hora" : "horas",
    minutes: card.currentInterval === 1 ? "minuto" : "minutos",
  } as const;
  return `${card.currentInterval} ${names[card.intervalUnit]}`;
}

export function NoteCards({ cards, onChanged }: { cards: Card[]; onChanged: () => void }) {
  const { services } = useApp();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [removing, setRemoving] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visible = cards.filter((card) => filter === "all" || card.state === filter);

  async function run(work: () => Promise<unknown>) {
    setError(null);
    try {
      await work();
      onChanged();
    } catch (reason) {
      setError(services.describeError(reason));
    }
  }

  return (
    <div className="stack">
      {cards.length === 0 ? <p className="muted">Nenhum cartão nesta nota. Selecione um trecho no editor para criar o primeiro.</p> : (
        <div className="focus-presets" role="group" aria-label="Filtrar cartões">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" className="button secondary" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>
          ))}
        </div>
      )}
      {cards.length > 0 && visible.length === 0 ? <p className="muted">Nenhum cartão neste filtro.</p> : null}
      {visible.map((card) => (
        <article key={card.id} className="inspector-card card-editor">
          <div className="row-between">
            <strong>{card.question}</strong>
            <span className={`state-pill state-${card.state}`}>{STATE_LABEL[card.state]}</span>
          </div>
          <p>{card.answer}</p>
          <p className="meta">
            Intervalo {intervalLabel(card)}
            {" · "}
            {card.correctCount} acertos, {card.incorrectCount} erros
            {" · "}
            Dificuldade {card.difficulty.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
          </p>
          <p className="meta">
            Próxima revisão {new Date(card.nextReviewAt).toLocaleString("pt-BR")}
            {card.lastReviewedAt ? ` · Última ${new Date(card.lastReviewedAt).toLocaleString("pt-BR")}` : " · Ainda não revisado"}
          </p>
          {editing === card.id ? (
            <form onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await services.cards.update(card.id, { question, answer });
                setEditing(null);
              });
            }}>
              <label className="field"><span>Pergunta</span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
              <label className="field"><span>Resposta</span><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} /></label>
              <div className="focus-actions">
                <button className="button" type="submit">Salvar cartão</button>
                <button className="button secondary" type="button" onClick={() => setEditing(null)}>Cancelar</button>
              </div>
            </form>
          ) : (
            <div className="focus-actions card-tools">
              <button type="button" className="button secondary" onClick={() => { setEditing(card.id); setQuestion(card.question); setAnswer(card.answer); }}>Editar</button>
              {card.state !== "active" ? <button type="button" className="button secondary" onClick={() => void run(() => services.cards.setState(card.id, "active"))}>{card.state === "archived" ? "Restaurar" : "Reativar"}</button> : null}
              {card.state === "active" ? <button type="button" className="button secondary" onClick={() => void run(() => services.cards.setState(card.id, "suspended"))}>Suspender</button> : null}
              {card.state !== "archived" ? <button type="button" className="button secondary" onClick={() => void run(() => services.cards.setState(card.id, "archived"))}>Arquivar</button> : null}
              <button type="button" className="button danger" onClick={() => setRemoving(card)}>Excluir</button>
            </div>
          )}
        </article>
      ))}
      {error ? <p role="alert">{error}</p> : null}
      <ConfirmDialog
        open={Boolean(removing)}
        title="Excluir este cartão?"
        body="A exclusão é definitiva. O histórico de respostas já registradas permanece, e o agendamento deste cartão deixa de existir."
        confirmLabel="Excluir cartão"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return;
          const id = removing.id;
          setRemoving(null);
          void run(() => services.cards.remove(id));
        }}
      />
    </div>
  );
}
