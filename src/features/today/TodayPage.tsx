import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../app/context";
import type { Card, Note, Subject } from "../../domain/models";
import { readingMinutes } from "../../domain/content";
import { useUiStore } from "../../stores/ui-store";
import { FocusPanel } from "../focus/FocusPanel";
import { EmptyState } from "../../ui/components";
import { useWindowWidth } from "../../ui/use-window-width";

export function TodayPage() {
  const { services, desktop } = useApp();
  const navigate = useNavigate();
  const inspectorCollapsed = useUiStore((state) => state.inspectorCollapsed);
  const narrow = useWindowWidth() < 1240;
  const [notes, setNotes] = useState<Note[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [due, setDue] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [capture, setCapture] = useState("");
  const [capturedId, setCapturedId] = useState<string | null>(null);
  const dataEpoch = useUiStore((state) => state.dataEpoch);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([services.notes.list(), services.subjects.list(), services.cards.due()])
      .then(([nextNotes, nextSubjects, nextDue]) => {
        if (cancelled) return;
        setNotes(nextNotes);
        setSubjects(nextSubjects);
        setDue(nextDue);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(services.describeError(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [dataEpoch, services]);

  if (error) return <div className="today-main"><h2>Não foi possível abrir seus estudos</h2><p>{error}</p></div>;
  if (notes.length === 0 && due.length === 0) {
    return (
      <div className="today-main">
        <EmptyState
          title="Nada em andamento hoje"
          body="Crie uma matéria e uma nota para retomar o estudo daqui. O ZenStudies funciona sem conteúdo de exemplo."
          action="Criar primeira nota"
          onAction={() => void services.notes.create().then((note) => navigate(`/notas/${note.id}`))}
        />
        <FocusPanel note={null} />
      </div>
    );
  }

  const current = notes[0];
  const subject = subjects.find((item) => item.id === current?.subjectId);
  const groups = groupCards(due);
  const date = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="today-layout" data-inspector={inspectorCollapsed || narrow ? "closed" : "open"}>
      <div className="today-main">
        <p className="kicker">{date}</p>
        <h2 className="display">Continue de onde parou</h2>
        <FocusPanel note={current ? { id: current.id, title: current.title, detail: `${subject?.name ?? "Sem matéria"} · ${readingMinutes(current.text)} min` } : null} />
        <h3 className="display" style={{ fontSize: 25, marginTop: 36 }}>Depois do foco</h3>
        <div className="card-grid">
          <article className="surface-card">
            <h3>{groups[0]?.name ?? "Revisões"}</h3>
            <p>{due.length === 0 ? "Nenhum cartão vence hoje." : `${cardCount(due.length)} em ${groups.length} ${groups.length === 1 ? "matéria" : "matérias"}`}</p>
            <button type="button" className="shortcut-link" onClick={() => navigate("/revisoes/sessao")}>Iniciar revisão</button>
          </article>
          <article className="surface-card">
            <h3>Nota rápida</h3>
            <form onSubmit={(event) => {
              event.preventDefault();
              const text = capture.trim();
              if (!text) return;
              void services.notes.create({ title: text.slice(0, 48), text }).then((note) => {
                setCapture("");
                setCapturedId(note.id);
              });
            }}>
              <label className="field">
                <span>Captura sem sair de Hoje</span>
                <textarea aria-label="Captura rápida" rows={3} value={capture} onChange={(event) => setCapture(event.target.value)} />
              </label>
              <div className="focus-actions">
                <button type="submit" className="button">Guardar</button>
                <button type="button" className="button ghost" onClick={() => void desktop.openWindow({ label: "capture", route: "/captura", title: "Captura rápida", width: 520, height: 420 })}>Janela compacta</button>
              </div>
            </form>
            {capturedId ? <button type="button" className="shortcut-link" onClick={() => navigate(`/notas/${capturedId}`)}>Abrir a nota guardada</button> : null}
          </article>
        </div>
      </div>
      {inspectorCollapsed ? null : (
        <aside className="inspector" aria-label="Revisões de hoje">
          <h2>Revisões de hoje</h2>
          <p className="muted">{due.length === 0 ? "A fila está em dia." : due.length === 1 ? "1 cartão pronto para revisar." : `${due.length} cartões prontos para revisar.`}</p>
          <div className="stack">
            {groups.map((group) => (
              <div className="list-card" key={group.name}>
                <i className="subject-dot" style={{ background: group.color }} />
                <div>
                  <strong>{group.name}</strong>
                  <div className="meta">{cardCount(group.count)}</div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="button" style={{ width: "100%", marginTop: 16 }} onClick={() => navigate("/revisoes/sessao")}>Iniciar revisão</button>
          <div className="nav-section" style={{ color: "var(--muted)" }}>Atalhos</div>
          <div className="shortcut-row"><span>Nova nota</span><span>Ctrl N</span></div>
          <div className="shortcut-row"><span>Buscar tudo</span><span>Ctrl K</span></div>
          <div className="shortcut-row"><span>Abrir revisão</span><span>Espaço, 1, 2, 3</span></div>
        </aside>
      )}
    </div>
  );
}

function cardCount(count: number): string {
  return `${count} ${count === 1 ? "cartão" : "cartões"}`;
}

function groupCards(cards: Card[]) {
  const map = new Map<string, { name: string; count: number; color: string }>();
  for (const card of cards) {
    const key = card.subjectName || "Sem matéria";
    const current = map.get(key) ?? { name: key, count: 0, color: "#6558E8" };
    current.count += 1;
    map.set(key, current);
  }
  return [...map.values()];
}
