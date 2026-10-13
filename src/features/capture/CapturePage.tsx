import { useEffect, useState } from "react";
import { useApp } from "../../app/context";
import type { Subject } from "../../domain/models";

export function CapturePage() {
  const { services, desktop } = useApp();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void services.subjects.list().then(setSubjects);
  }, [services]);

  async function save() {
    if (!text.trim() && !title.trim()) return;
    await services.notes.create({ title: title || text.slice(0, 48), subjectId: subjectId || null, text });
    if (await desktop.currentLabel() === "capture") {
      await desktop.closeCurrent();
      return;
    }
    setSaved(true);
  }

  return (
    <div className="capture-window">
      <h1 className="display" style={{ fontSize: 28 }}>Captura rápida</h1>
      <label className="field"><span>Título</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="field"><span>Matéria</span>
        <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
          <option value="">Sem matéria</option>
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
      </label>
      <label className="field"><span>Nota</span><textarea data-editor-root="true" rows={6} value={text} onChange={(event) => setText(event.target.value)} /></label>
      <button type="button" className="button" onClick={() => void save()}>Guardar nota</button>
      {saved ? <p role="status">Nota guardada neste computador.</p> : null}
    </div>
  );
}
