import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../app/context";
import type { Attachment, Card, Note, PdfDocument, Subject } from "../../domain/models";
import { SUBJECT_COLORS, subjectColorLabel } from "../../domain/subjects";
import { useUiStore } from "../../stores/ui-store";
import { ConfirmDialog, EmptyState } from "../../ui/components";

export function LibraryPage() {
  const { services } = useApp();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [pdfs, setPdfs] = useState<PdfDocument[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(SUBJECT_COLORS[0].value);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<Subject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dataEpoch = useUiStore((state) => state.dataEpoch);

  async function reload() {
    const [nextSubjects, nextAttachments, nextNotes, nextCards, nextPdfs] = await Promise.all([
      services.subjects.list(),
      services.attachments.list(),
      services.notes.list(),
      services.cards.list(),
      services.pdfs.list(),
    ]);
    setSubjects(nextSubjects);
    setAttachments(nextAttachments);
    setNotes(nextNotes);
    setCards(nextCards);
    setPdfs(nextPdfs);
  }
  useEffect(() => { void reload().catch((reason: unknown) => setError(services.describeError(reason))); }, [dataEpoch, services]);

  async function run(work: () => Promise<unknown>) {
    setError(null);
    try {
      await work();
      await reload();
    } catch (reason) {
      setError(services.describeError(reason));
    }
  }

  return (
    <div className="today-main">
      <h2 className="display">Biblioteca</h2>
      {subjects.length === 0 ? (
        <EmptyState title="Nenhuma matéria ainda" body="Uma matéria organiza notas, cartões e PDFs. Crie a primeira para começar a separar os ciclos de estudo." action="Criar matéria" onAction={() => void services.subjects.create("Nova matéria").then(reload)} />
      ) : null}
      <form className="surface-card" onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        void run(async () => {
          await services.subjects.create(name, color);
          setName("");
        });
      }}>
        <label className="field"><span>Nova matéria</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="focus-actions">
          {SUBJECT_COLORS.map((item) => <button key={item.value} type="button" className="color-dot" style={{ background: item.value }} aria-label={item.label} aria-pressed={color === item.value} onClick={() => setColor(item.value)} />)}
          <button className="button" type="submit">Adicionar</button>
        </div>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <div className="stack" style={{ marginTop: 16 }}>
        {subjects.map((subject) => {
          const noteCount = notes.filter((note) => note.subjectId === subject.id).length;
          const cardCount = cards.filter((card) => card.subjectId === subject.id).length;
          const pdfCount = pdfs.filter((pdf) => pdf.subjectId === subject.id).length;
          const draft = drafts[subject.id] ?? subject.name;
          return (
            <article key={subject.id} className="list-card subject-manage">
              <button type="button" className="subject-open" onClick={() => navigate(`/notas?materia=${subject.id}`)}>
                <i className="subject-dot" style={{ background: subject.color }} />
                <span>
                  <strong>{subject.name}</strong>
                  <small className="meta">{noteCount} {noteCount === 1 ? "nota" : "notas"} · {cardCount} {cardCount === 1 ? "cartão" : "cartões"} · {pdfCount} {pdfCount === 1 ? "PDF" : "PDFs"}</small>
                </span>
              </button>
              <label className="field subject-name">
                <span>Nome</span>
                <input value={draft} onChange={(event) => setDrafts((current) => ({ ...current, [subject.id]: event.target.value }))} />
              </label>
              <div className="focus-presets" role="group" aria-label={`Cor de ${subject.name}`}>
                {SUBJECT_COLORS.map((item) => (
                  <button key={item.value} type="button" className="color-dot" style={{ background: item.value }} aria-label={item.label} aria-pressed={subject.color.toLowerCase() === item.value.toLowerCase()} onClick={() => void run(() => services.subjects.recolor(subject.id, item.value))} />
                ))}
              </div>
              <p className="meta">Cor atual: {subjectColorLabel(subject.color)}</p>
              <div className="focus-actions">
                <button type="button" className="button secondary" onClick={() => void run(() => services.subjects.rename(subject.id, draft))}>Salvar nome</button>
                <button type="button" className="button danger" onClick={() => setRemoving(subject)}>Excluir</button>
              </div>
            </article>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(removing)}
        title={removing ? `Excluir ${removing.name}?` : "Excluir matéria?"}
        body="As notas, os cartões, os PDFs, os anexos e o histórico de revisão permanecem. Eles ficam sem esta matéria."
        confirmLabel="Excluir matéria"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return;
          const id = removing.id;
          setRemoving(null);
          void run(() => services.subjects.remove(id));
        }}
      />
      <h3>Anexos</h3>
      {attachments.length === 0 ? <p className="muted">Imagens e áudios das notas aparecem aqui, sem serem embutidos no texto.</p> : attachments.map((item) => <div key={item.id} className="meta">{item.originalName} · {item.kind}</div>)}
    </div>
  );
}
