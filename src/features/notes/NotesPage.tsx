import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { PanelRight, Pin, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApp } from "../../app/context";
import type { Attachment, Card, Note, Subject } from "../../domain/models";
import { loadPreferences, savePreferences } from "../../domain/preferences";
import { useUiStore } from "../../stores/ui-store";
import { NoteCards } from "./NoteCards";
import { EmptyState, IconTip } from "../../ui/components";
import { useWindowWidth } from "../../ui/use-window-width";
import { NoteEditor } from "./NoteEditor";

gsap.registerPlugin(useGSAP);

export function NotesPage({ detached = false }: { detached?: boolean }) {
  const { services, desktop } = useApp();
  const navigate = useNavigate();
  const params = useParams();
  const [search] = useSearchParams();
  const subjectFilter = search.get("materia");
  const [notes, setNotes] = useState<Note[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [links, setLinks] = useState<{ id: string; note: Note }[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [query, setQuery] = useState("");
  const inspectorCollapsed = useUiStore((state) => state.inspectorCollapsed);
  const setInspector = useUiStore((state) => state.setInspectorCollapsed);
  const pushToast = useUiStore((state) => state.pushToast);
  const noteId = params.noteId ?? "";
  const selected = notes.find((note) => note.id === noteId) ?? null;
  const subject = subjects.find((item) => item.id === selected?.subjectId) ?? null;
  const dataEpoch = useUiStore((state) => state.dataEpoch);
  const width = useWindowWidth();
  const inspectorClosed = inspectorCollapsed || width < 1240;
  const inspectorRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (!inspectorRef.current || document.documentElement.dataset.motion !== "full") return;
    gsap.from(inspectorRef.current, { x: 12, opacity: 0, duration: 0.22, ease: "power2.out" });
  }, { dependencies: [inspectorClosed, selected?.id] });

  async function reload() {
    const [nextNotes, nextSubjects] = await Promise.all([services.notes.list(), services.subjects.list()]);
    setNotes(nextNotes);
    setSubjects(nextSubjects);
    if (noteId) {
      setLinks(await services.links.forNote(noteId));
      setCards(await services.cards.forNote(noteId));
      const all = await services.attachments.list();
      setAttachments(all.filter((item) => item.noteId === noteId));
    }
  }

  useEffect(() => {
    void reload();
  }, [dataEpoch, noteId, services]);

  const visible = notes.filter((note) => {
    if (subjectFilter && note.subjectId !== subjectFilter) return false;
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return !needle || `${note.title} ${note.text}`.toLocaleLowerCase("pt-BR").includes(needle);
  });

  return (
    <div className="notes-layout" data-inspector={inspectorClosed || detached ? "closed" : "open"}>
      {detached ? null : (
        <aside className="note-list">
          <div className="row-between">
            <h2>Notas</h2>
            <button type="button" className="button" onClick={() => void services.notes.create({ subjectId: subjectFilter }).then((note) => navigate(`/notas/${note.id}`))}>Nova</button>
          </div>
          <input className="search-input" placeholder="Buscar notas" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar notas" />
          {visible.length === 0 ? <p className="muted">Nenhuma nota nesta vista.</p> : null}
          <p className="kicker">Recentes</p>
          {visible.map((note) => (
            <button key={note.id} type="button" className={`note-row${note.id === noteId ? " active" : ""}`} data-peek-id={note.id} onClick={() => navigate(`/notas/${note.id}`)}>
              <strong>{note.title}</strong>
              <small>{subjects.find((item) => item.id === note.subjectId)?.name ?? "Sem matéria"}</small>
            </button>
          ))}
        </aside>
      )}
      {selected ? (
        <NoteEditor key={selected.id} note={selected} subject={subject} />
      ) : (
        <div className="editor-pane">
          <EmptyState title="Escolha uma nota" body="A mesa fica pronta quando existe uma nota para escrever. Crie a primeira ou abra uma da lista." action="Nova nota" onAction={() => void services.notes.create().then((note) => navigate(`/notas/${note.id}`))} />
        </div>
      )}
      {inspectorClosed || detached || !selected ? null : (
        <aside ref={inspectorRef} className="inspector">
          <div className="row-between">
            <h2>Contexto</h2>
            <IconTip label="Recolher inspector">
              <button type="button" className="icon-button" aria-label="Recolher inspector" onClick={() => {
                setInspector(true);
                const preferences = loadPreferences();
                savePreferences({ ...preferences, inspectorCollapsed: true });
              }}><PanelRight size={18} /></button>
            </IconTip>
          </div>
          <p className="kicker">Conexões · {links.length}</p>
          <div className="stack">
            {links.map((link) => (
              <button key={link.id} type="button" className="list-card" onClick={() => navigate(`/notas/${link.note.id}`)}>
                <span><strong>{link.note.title}</strong><small className="meta">Nota relacionada</small></span>
              </button>
            ))}
          </div>
          <p className="kicker">Cartões · {cards.length}</p>
          <NoteCards cards={cards} onChanged={() => void reload()} />
          {cards.some((card) => card.state === "active") ? <button type="button" className="button" onClick={() => navigate("/revisoes/sessao")}>Revisar agora</button> : null}
          <p className="kicker">Anexos · {attachments.length}</p>
          {attachments.map((attachment) => <div key={attachment.id} className="meta">{attachment.originalName}</div>)}
          <p className="kicker">Propriedades</p>
          <label className="field">
            <span>Matéria</span>
            <select value={selected.subjectId ?? ""} onChange={(event) => void services.notes.save({ id: selected.id, title: selected.title, content: selected.content, text: selected.text, subjectId: event.target.value || null, baseRevision: selected.revision }).then(() => reload())}>
              <option value="">Sem matéria</option>
              {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div className="focus-actions">
            <button type="button" className="icon-button" aria-label={selected.pinned ? "Desafixar" : "Fixar"} onClick={() => void services.notes.setPinned(selected.id, !selected.pinned).then(reload)}><Pin size={16} /></button>
            <button type="button" className="icon-button" aria-label="Mover para a lixeira" onClick={() => void services.notes.softDelete(selected.id).then((item) => {
              pushToast({ message: "Nota movida para a lixeira", actionLabel: "Desfazer", onAction: () => void services.trash.restore(item.id) });
              navigate("/notas");
            })}><Trash2 size={16} /></button>
            <button type="button" className="button secondary" onClick={() => void desktop.openWindow({ label: `note-${selected.id}`, route: `/janela/nota/${selected.id}`, title: selected.title, width: 960, height: 760 })}>Destacar</button>
          </div>
        </aside>
      )}
    </div>
  );
}
