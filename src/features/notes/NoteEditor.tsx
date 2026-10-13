import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { EditorContent, useEditor } from "@tiptap/react";
import DOMPurify from "dompurify";
import { useEffect, useMemo, useRef, useState } from "react";
import { AutosaveController, registerFlusher } from "../../application/autosave";
import { ConflictError } from "../../application/services";
import { useApp } from "../../app/context";
import { extractText } from "../../domain/content";
import type { Note, NoteDraft, RichContent, Subject } from "../../domain/models";
import { cleanTitle, isSafeUrl } from "../../domain/sanitize";
import { detectSlash, detectWiki, filterCommands, type BlockCommandId } from "../../domain/triggers";
import { useUiStore } from "../../stores/ui-store";
import { TextDialog } from "../../ui/components";
import { editorExtensions, pickFile } from "./extensions";

gsap.registerPlugin(useGSAP);

const ALLOWED_TAGS = ["p", "br", "strong", "em", "ul", "ol", "li", "blockquote", "code", "pre", "h2", "h3", "a"];

export function NoteEditor({ note, subject }: { note: Note; subject: Subject | null }) {
  const { services, desktop } = useApp();
  const setSaveStatus = useUiStore((state) => state.setSaveStatus);
  const setUnsavedText = useUiStore((state) => state.setUnsavedText);
  const setConflict = useUiStore((state) => state.setConflict);
  const conflict = useUiStore((state) => state.conflict);
  const revision = useRef(note.revision);
  const subjectRef = useRef(note.subjectId);
  const titleRef = useRef(note.title);
  const forceRef = useRef(false);
  const [title, setTitle] = useState(note.title);
  const [recovery, setRecovery] = useState<NoteDraft | null>(null);
  const [slash, setSlash] = useState<{ query: string; from: number; x: number; y: number } | null>(null);
  const [wiki, setWiki] = useState<{ query: string; from: number; x: number; y: number } | null>(null);
  const [bubble, setBubble] = useState<{ text: string; x: number; y: number } | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [linkError, setLinkError] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const cardDialogRef = useRef<HTMLDivElement>(null);
  const recoveryChecked = useRef(false);

  useGSAP(() => {
    if (!cardOpen || !cardDialogRef.current || document.documentElement.dataset.motion !== "full") return;
    gsap.from(cardDialogRef.current, { y: 8, opacity: 0, scale: 0.96, duration: 0.28, ease: "power2.out" });
  }, { dependencies: [cardOpen] });

  subjectRef.current = note.subjectId;
  titleRef.current = title;

  const controller = useMemo(
    () =>
      new AutosaveController<RichContent>({
        noteId: note.id,
        delayMs: 600,
        persist: async (snapshot) => {
          await services.notes.saveDraft({
            id: note.id,
            noteId: note.id,
            title: snapshot.title,
            content: snapshot.content,
            text: snapshot.text,
            baseRevision: revision.current,
            updatedAt: new Date().toISOString(),
          });
          const result = await services.notes.save({
            id: note.id,
            title: snapshot.title,
            content: snapshot.content,
            text: snapshot.text,
            subjectId: subjectRef.current,
            baseRevision: revision.current,
            force: forceRef.current,
          });
          forceRef.current = false;
          if (!result.ok && result.reason === "conflict") {
            setConflict(result.current);
            throw new ConflictError(result.current);
          }
          if (!result.ok) throw new Error("A nota não está mais disponível.");
          revision.current = result.note.revision;
        },
        onStatus: (status, message) => {
          setSaveStatus(status, message);
          if (status === "error" && message) setSaveStatus("error", message);
        },
      }),
    [note.id, services, setConflict, setSaveStatus],
  );

  const editor = useEditor({
    extensions: editorExtensions(),
    content: note.content,
    immediatelyRender: true,
    editorProps: {
      attributes: {
        "data-editor-root": "true",
        "aria-label": "Editor da nota",
      },
      transformPastedHTML: (html) => DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ["href"] }),
      handlePaste: (_view, event) => {
        const images = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith("image/"));
        if (images.length === 0) return false;
        void importImageFiles(note.id, images, (attachmentId, alt) => {
          editor?.chain().focus().insertContent({ type: "imageAttachment", attrs: { attachmentId, alt, caption: "" } }).run();
        });
        return true;
      },
      handleDrop: (_view, event) => {
        const images = [...(event.dataTransfer?.files ?? [])].filter((file) => file.type.startsWith("image/"));
        if (images.length === 0) return false;
        event.preventDefault();
        void importImageFiles(note.id, images, (attachmentId, alt) => {
          editor?.chain().focus().insertContent({ type: "imageAttachment", attrs: { attachmentId, alt, caption: "" } }).run();
        });
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      if (recovery) return;
      const content = current.getJSON() as RichContent;
      const text = extractText(content);
      setUnsavedText(text);
      controller.push({
        title: titleRef.current,
        text,
        content,
        subjectId: subjectRef.current,
        baseRevision: revision.current,
      });
      updateMenus(current);
    },
    onSelectionUpdate: ({ editor: current }) => {
      const { from, to } = current.state.selection;
      if (from === to) {
        setBubble(null);
        return;
      }
      const text = current.state.doc.textBetween(from, to, " ").trim();
      const selection = window.getSelection();
      const rect = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).getBoundingClientRect() : null;
      if (!text || !rect) {
        setBubble(null);
        return;
      }
      setBubble({ text, x: rect.left, y: Math.max(8, rect.top - 48) });
    },
  });

  useEffect(() => registerFlusher(async () => {
    await controller.flush();
  }), [controller]);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    void desktop.onFileDrop((paths) => {
      void (async () => {
        for (const path of paths) {
          const kind = mediaKind(path);
          if (!kind || !editor) continue;
          const stored = await services.attachments.importPath(note.id, path, kind);
          const name = path.split(/[/\\]/).pop() ?? "arquivo";
          const type = kind === "image" ? "imageAttachment" : "audioAttachment";
          editor.chain().focus().insertContent({ type, attrs: { attachmentId: stored.id, alt: name, fileName: name, caption: "" } }).run();
        }
      })();
    }).then((stop) => {
      unsubscribe = stop;
    });
    return () => unsubscribe();
  }, [desktop, editor, note.id, services]);

  useEffect(() => {
    void services.notes.list().then(setNotes);
    if (!editor) return;
    if (!recoveryChecked.current) {
      recoveryChecked.current = true;
      void services.notes.recovery(note.id).then(setRecovery);
    }
    if (note.revision === revision.current) return;
    const localText = editor.getText().replace(/\s+/g, " ").trim();
    const savedText = note.text.replace(/\s+/g, " ").trim();
    const status = useUiStore.getState().saveStatus;
    if (localText !== savedText || status === "saving" || status === "error") {
      setConflict(note);
      return;
    }
    editor.commands.setContent(note.content, { emitUpdate: false });
    setTitle(note.title);
    revision.current = note.revision;
    void services.notes.recovery(note.id).then(setRecovery);
  }, [editor, note, services, setConflict]);

  useEffect(() => {
    editor?.setEditable(!recovery);
  }, [editor, recovery]);

  function updateMenus(current = editor) {
    if (!current) return;
    const { from } = current.state.selection;
    const textBefore = current.state.doc.textBetween(Math.max(0, from - 80), from, "\n", "\0");
    const coords = current.view.coordsAtPos(from);
    const slashMatch = detectSlash(textBefore);
    const wikiMatch = detectWiki(textBefore);
    setSlash(slashMatch ? { ...slashMatch, x: coords.left, y: coords.bottom + 6 } : null);
    setWiki(wikiMatch ? { ...wikiMatch, x: coords.left, y: coords.bottom + 6 } : null);
  }

  async function runCommand(id: BlockCommandId) {
    if (!editor || !slash) return;
    const to = editor.state.selection.from;
    editor.chain().focus().deleteRange({ from: slash.from, to }).run();
    if (id === "paragraph") editor.chain().focus().setParagraph().run();
    if (id === "heading") editor.chain().focus().toggleHeading({ level: 2 }).run();
    if (id === "bullet") editor.chain().focus().toggleBulletList().run();
    if (id === "ordered") editor.chain().focus().toggleOrderedList().run();
    if (id === "task") editor.chain().focus().toggleTaskList().run();
    if (id === "quote") editor.chain().focus().toggleBlockquote().run();
    if (id === "code") editor.chain().focus().toggleCodeBlock().run();
    if (id === "rule") editor.chain().focus().setHorizontalRule().run();
    if (id === "image" || id === "audio") {
      const file = await pickFile(id === "image" ? "image/*" : "audio/*");
      if (!file) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const stored = await services.attachments.importBytes(note.id, file.name, bytes, id === "image" ? "image" : "audio");
      const type = id === "image" ? "imageAttachment" : "audioAttachment";
      editor.chain().focus().insertContent({ type, attrs: { attachmentId: stored.id, alt: file.name, fileName: file.name, caption: "" } }).run();
    }
    setSlash(null);
  }

  const saveLabel = useUiStore((state) => state.saveStatus);
  const saveDetail = useUiStore((state) => state.saveDetail);
  const label = saveLabel === "saving" ? "Salvando…" : saveLabel === "error" ? "Não foi possível salvar" : "Salvo agora";

  return (
    <div className="editor-pane">
      <div className="editor-bar">
        <span>{subject ? `Matéria / ${subject.name}` : "Sem matéria"}</span>
        <span role="status" aria-live="polite" className={saveLabel === "error" ? "save-bad" : "save-ok"}>
          {label}
          {saveLabel === "error" ? <button type="button" className="shortcut-link" onClick={() => void controller.retry()}>Tentar de novo</button> : null}
          {saveLabel === "error" && saveDetail ? <span>{saveDetail}</span> : null}
        </span>
      </div>
      <div className="editor-column">
        {recovery ? (
          <div className="banner">
            <span>Há um rascunho mais recente do que a última versão salva.</span>
            <span>
              <button type="button" className="button" onClick={() => { editor?.commands.setContent(recovery.content); setTitle(recovery.title); setRecovery(null); }}>Restaurar</button>
              <button type="button" className="button secondary" onClick={() => void services.notes.discardDraft(note.id).then(() => setRecovery(null))}>Descartar</button>
            </span>
          </div>
        ) : null}
        <p className="kicker">{subject?.name ?? "Nota"}</p>
        <input
          className="note-title"
          aria-label="Título da nota"
          value={title}
          onChange={(event) => {
            const next = event.target.value;
            setTitle(next);
            titleRef.current = next;
            if (!editor || recovery) return;
            controller.push({
              title: next,
              text: extractText(editor.getJSON() as RichContent),
              content: editor.getJSON() as RichContent,
              subjectId: subjectRef.current,
              baseRevision: revision.current,
            });
          }}
        />
        <EditorContent editor={editor} />
      </div>
      {slash ? (
        <div className="slash-menu" style={{ left: slash.x, top: slash.y }} role="listbox" aria-label="Blocos">
          {filterCommands(slash.query).map((command) => (
            <button key={command.id} type="button" className="menu-item" onClick={() => void runCommand(command.id)}>{command.label}</button>
          ))}
        </div>
      ) : null}
      {wiki ? (
        <div className="slash-menu" style={{ left: wiki.x, top: wiki.y }} role="listbox" aria-label="Notas relacionadas">
          {notes.filter((item) => item.id !== note.id && item.title.toLocaleLowerCase("pt-BR").includes(wiki.query.toLocaleLowerCase("pt-BR"))).slice(0, 6).map((item) => (
            <button
              key={item.id}
              type="button"
              className="menu-item"
              onClick={() => {
                if (!editor) return;
                editor.chain().focus().deleteRange({ from: wiki.from, to: editor.state.selection.from }).insertContent({ type: "noteLink", attrs: { noteId: item.id, title: item.title } }).run();
                setWiki(null);
              }}
            >
              {item.title}
            </button>
          ))}
        </div>
      ) : null}
      {bubble ? (
        <div className="bubble" style={{ left: bubble.x, top: bubble.y }}>
          <button type="button" className="icon-button" aria-label="Negrito" onClick={() => editor?.chain().focus().toggleBold().run()}>B</button>
          <button type="button" className="icon-button" aria-label="Itálico" onClick={() => editor?.chain().focus().toggleItalic().run()}>I</button>
          <button type="button" className="icon-button" aria-label="Link" onClick={() => { setLinkUrl("https://"); setLinkError(""); setLinkOpen(true); }}>Link</button>
          <button type="button" className="button" onClick={() => { setQuestion(bubble.text.slice(0, 180)); setAnswer(bubble.text); setCardOpen(true); }}>Criar cartão</button>
        </div>
      ) : null}
      {cardOpen ? (
        <div className="overlay-mask" />
      ) : null}
      {cardOpen ? (
        <div ref={cardDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="card-title">
          <h2 id="card-title">Novo cartão</h2>
          <label className="field"><span>Pergunta</span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
          <label className="field"><span>Resposta</span><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} /></label>
          <div className="focus-actions">
            <button type="button" className="button secondary" onClick={() => setCardOpen(false)}>Cancelar</button>
            <button type="button" className="button" onClick={() => void services.cards.create({ noteId: note.id, question, answer }).then(() => setCardOpen(false))}>Salvar cartão</button>
          </div>
        </div>
      ) : null}
      <TextDialog
        open={linkOpen}
        title="Endereço do link"
        body="Use http, https ou mailto."
        confirmLabel="Aplicar"
        fields={(
          <label className="field">
            <span>URL</span>
            <input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} />
            {linkError ? <span className="save-bad">{linkError}</span> : null}
          </label>
        )}
        onCancel={() => setLinkOpen(false)}
        onConfirm={() => {
          if (!isSafeUrl(linkUrl)) {
            setLinkError("O endereço precisa começar com http, https ou mailto.");
            return;
          }
          editor?.chain().focus().setLink({ href: linkUrl }).run();
          setLinkOpen(false);
        }}
      />
      {conflict && conflict.id === note.id ? (
        <div className="overlay-mask" />
      ) : null}
      {conflict && conflict.id === note.id ? (
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
          <h2 id="conflict-title">Esta nota mudou em outra janela</h2>
          <p>Escolha qual versão manter. O texto que você está vendo não será descartado sem uma escolha.</p>
          <div className="focus-actions">
            <button type="button" className="button" onClick={() => { forceRef.current = true; setConflict(null); void controller.retry(); }}>Manter o meu texto</button>
            <button type="button" className="button secondary" onClick={() => { editor?.commands.setContent(conflict.content); setTitle(conflict.title); revision.current = conflict.revision; setConflict(null); }}>Usar a versão salva</button>
            <button type="button" className="button secondary" onClick={() => void services.notes.create({ title: `${cleanTitle(title)} (cópia)`, text: editor ? extractText(editor.getJSON() as RichContent) : "" }).then(() => setConflict(null))}>Guardar cópia</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function mediaKind(path: string): "image" | "audio" | null {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) return "image";
  if (["mp3", "wav", "ogg", "m4a"].includes(extension)) return "audio";
  return null;
}

async function importImageFiles(noteId: string, files: File[], insert: (id: string, alt: string) => void) {
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await boundImport(noteId, file.name, bytes);
    insert(stored.id, file.name);
  }
}

async function boundImport(noteId: string, name: string, bytes: Uint8Array) {
  const { boundServices } = await import("../../app/registry");
  return boundServices().attachments.importBytes(noteId, name, bytes, "image");
}
