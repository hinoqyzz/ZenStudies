import { Node, mergeAttributes } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { isSafeUrl } from "../../domain/sanitize";
import { boundServices } from "../../app/registry";

function bytesBlob(bytes: Uint8Array, mime: string): Blob {
  const copy = new Uint8Array(bytes);
  return new Blob([copy], { type: mime });
}

function ImageAttachmentView({ node, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const attachmentId = String(node.attrs.attachmentId ?? "");
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [ticket, setTicket] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    void boundServices()
      .attachments.read(attachmentId)
      .then((bytes) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(bytesBlob(bytes, "image/*"));
        setUrl(objectUrl);
        setMissing(false);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, ticket]);

  return (
    <NodeViewWrapper className="attachment-block" data-attachment-id={attachmentId}>
      {missing ? (
        <div className="missing-file">
          <p>A imagem não foi encontrada no armazenamento do aplicativo.</p>
          <button type="button" className="button secondary" onClick={() => void relink(attachmentId, "image").then(() => setTicket((value) => value + 1))}>Localizar novamente</button>
        </div>
      ) : url ? (
        <img src={url} alt={String(node.attrs.alt ?? "")} />
      ) : (
        <p className="meta">Carregando imagem…</p>
      )}
      <label className="field">
        <span>Texto alternativo</span>
        <input value={String(node.attrs.alt ?? "")} onChange={(event) => updateAttributes({ alt: event.target.value })} onBlur={(event) => void boundServices().attachments.updateCaption(attachmentId, event.target.value, String(node.attrs.caption ?? ""))} />
      </label>
      <label className="field">
        <span>Legenda</span>
        <input value={String(node.attrs.caption ?? "")} onChange={(event) => updateAttributes({ caption: event.target.value })} onBlur={(event) => void boundServices().attachments.updateCaption(attachmentId, String(node.attrs.alt ?? ""), event.target.value)} />
      </label>
      <div className="focus-actions">
        <button type="button" className="button secondary" onClick={() => void boundServices().attachments.open(attachmentId)}>Abrir original</button>
        <button type="button" className="button ghost" onClick={deleteNode}>Remover da nota</button>
      </div>
    </NodeViewWrapper>
  );
}

function AudioAttachmentView({ node, deleteNode }: ReactNodeViewProps) {
  const attachmentId = String(node.attrs.attachmentId ?? "");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [ticket, setTicket] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    void boundServices()
      .attachments.read(attachmentId)
      .then(async (bytes) => {
        const attachment = (await boundServices().attachments.list()).find((item) => item.id === attachmentId);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(bytesBlob(bytes, attachment?.mimeType ?? "audio/mpeg"));
        setUrl(objectUrl);
        setMissing(false);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, ticket]);

  return (
    <NodeViewWrapper className="attachment-block">
      <strong>{String(node.attrs.fileName ?? "Áudio")}</strong>
      {missing ? (
        <div className="missing-file">
          <p>O áudio não foi encontrado no armazenamento do aplicativo.</p>
          <button type="button" className="button secondary" onClick={() => void relink(attachmentId, "audio").then(() => setTicket((value) => value + 1))}>Localizar novamente</button>
        </div>
      ) : url ? (
        <>
          <audio
            ref={audioRef}
            src={url}
            preload="metadata"
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
            onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
          />
          <div className="audio-row">
            <button type="button" className="button secondary" onClick={() => {
              const audio = audioRef.current;
              if (!audio) return;
              if (audio.paused) void audio.play();
              else audio.pause();
            }}>Reproduzir</button>
            <input aria-label="Progresso do áudio" type="range" min={0} max={duration || 0} step={0.1} value={progress} onChange={(event) => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value); }} />
            <span className="meta">{formatTime(progress)} / {formatTime(duration)}</span>
            <input aria-label="Volume" type="range" min={0} max={1} step={0.05} value={volume} onChange={(event) => { const next = Number(event.target.value); setVolume(next); if (audioRef.current) audioRef.current.volume = next; }} />
          </div>
        </>
      ) : (
        <p className="meta">Carregando áudio…</p>
      )}
      <div className="focus-actions">
        <button type="button" className="button secondary" onClick={() => void boundServices().attachments.open(attachmentId)}>Abrir original</button>
        <button type="button" className="button ghost" onClick={deleteNode}>Remover da nota</button>
      </div>
    </NodeViewWrapper>
  );
}

async function relink(id: string, kind: "image" | "audio") {
  const file = await pickFile(kind === "image" ? "image/*" : "audio/*");
  if (!file) return;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await boundServices().attachments.relink(id, file.name, bytes);
}

function NoteLinkView({ node }: ReactNodeViewProps) {
  const noteId = String(node.attrs.noteId ?? "");
  return (
    <NodeViewWrapper as="span">
      <button type="button" className="shortcut-link" onClick={() => { window.location.hash = `#/notas/${noteId}`; }}>
        {String(node.attrs.title ?? "Nota")}
      </button>
    </NodeViewWrapper>
  );
}

export const ImageAttachment = Node.create({
  name: "imageAttachment",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      attachmentId: { default: null },
      alt: { default: "" },
      caption: { default: "" },
    };
  },
  parseHTML: () => [{ tag: "figure[data-attachment-type='image']" }],
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { "data-attachment-type": "image" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageAttachmentView);
  },
});

export const AudioAttachment = Node.create({
  name: "audioAttachment",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { attachmentId: { default: null }, fileName: { default: "" } };
  },
  parseHTML: () => [{ tag: "figure[data-attachment-type='audio']" }],
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { "data-attachment-type": "audio" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(AudioAttachmentView);
  },
});

export const NoteLinkNode = Node.create({
  name: "noteLink",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { noteId: { default: null }, title: { default: "" } };
  },
  parseHTML: () => [{ tag: "a[data-note-id]" }],
  renderHTML({ HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes, { "data-note-id": HTMLAttributes.noteId }), HTMLAttributes.title ?? "Nota"];
  },
  addNodeView() {
    return ReactNodeViewRenderer(NoteLinkView);
  },
});

export function editorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: false,
    }),
    Link.configure({ openOnClick: false, autolink: false, validate: (href) => isSafeUrl(href) }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder: "Digite / para inserir um bloco ou [[ para conectar uma nota…" }),
    ImageAttachment,
    AudioAttachment,
    NoteLinkNode,
  ];
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

function formatTime(value: number): string {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
