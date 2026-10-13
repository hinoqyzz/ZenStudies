import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../app/context";
import type { Attachment, Subject } from "../../domain/models";
import { useUiStore } from "../../stores/ui-store";
import { EmptyState } from "../../ui/components";

const COLORS = ["#6558E8", "#73D8B2", "#E0B56D", "#187A58", "#101C1A"];

export function LibraryPage() {
  const { services } = useApp();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const dataEpoch = useUiStore((state) => state.dataEpoch);

  async function reload() {
    setSubjects(await services.subjects.list());
    setAttachments(await services.attachments.list());
  }
  useEffect(() => { void reload(); }, [dataEpoch, services]);

  return (
    <div className="today-main">
      <h2 className="display">Biblioteca</h2>
      {subjects.length === 0 ? (
        <EmptyState title="Nenhuma matéria ainda" body="Uma matéria organiza notas, cartões e PDFs. Crie a primeira para começar a separar os ciclos de estudo." action="Criar matéria" onAction={() => void services.subjects.create("Nova matéria").then(reload)} />
      ) : null}
      <form className="surface-card" onSubmit={(event) => { event.preventDefault(); if (!name.trim()) return; void services.subjects.create(name, color).then(() => { setName(""); void reload(); }); }}>
        <label className="field"><span>Nova matéria</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="focus-actions">
          {COLORS.map((item) => <button key={item} type="button" className="color-dot" style={{ background: item }} aria-label={item} aria-pressed={color === item} onClick={() => setColor(item)} />)}
          <button className="button" type="submit">Adicionar</button>
        </div>
      </form>
      <div className="stack" style={{ marginTop: 16 }}>
        {subjects.map((subject) => (
          <button key={subject.id} type="button" className="list-card" onClick={() => navigate(`/notas?materia=${subject.id}`)}>
            <i className="subject-dot" style={{ background: subject.color }} />
            <strong>{subject.name}</strong>
          </button>
        ))}
      </div>
      <h3>Anexos</h3>
      {attachments.length === 0 ? <p className="muted">Imagens e áudios das notas aparecem aqui, sem serem embutidos no texto.</p> : attachments.map((item) => <div key={item.id} className="meta">{item.originalName} · {item.kind}</div>)}
    </div>
  );
}
