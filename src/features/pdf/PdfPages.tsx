import { getDocument, GlobalWorkerOptions, PasswordException, type PDFDocumentProxy } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../app/context";
import { HIGHLIGHT_COLORS, normalizeRect } from "../../domain/annotations";
import type { NormRect, PdfAnnotation, PdfDocument, Subject } from "../../domain/models";
import { useUiStore } from "../../stores/ui-store";
import { EmptyState, TextDialog } from "../../ui/components";
import { importPdf } from "./import-pdf";

GlobalWorkerOptions.workerSrc = pdfWorker;

export function PdfLibraryPage() {
  const { services, desktop } = useApp();
  const navigate = useNavigate();
  const [pdfs, setPdfs] = useState<PdfDocument[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState("");
  const dataEpoch = useUiStore((state) => state.dataEpoch);

  async function reload() {
    setPdfs(await services.pdfs.list());
    setSubjects(await services.subjects.list());
  }
  useEffect(() => { void reload(); }, [dataEpoch, services]);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    void desktop.onFileDrop((paths) => {
      const pdf = paths.find((path) => path.toLowerCase().endsWith(".pdf"));
      if (!pdf) return;
      void services.pdfs.importPath(pdf).then((record) => navigate(`/pdfs/${record.id}`)).catch((reason: unknown) => setError(services.describeError(reason)));
    }).then((stop) => {
      unsubscribe = stop;
    });
    return () => unsubscribe();
  }, [desktop, navigate, services]);

  return (
    <div className="today-main" onDragOver={(event) => event.preventDefault()} onDrop={(event) => void dropPdf(event, services).then((pdf) => pdf && navigate(`/pdfs/${pdf.id}`)).catch((reason: unknown) => setError(services.describeError(reason)))}>
      <div className="row-between">
        <h2 className="display">PDFs</h2>
        <button type="button" className="button" onClick={() => void importPdf(services, desktop).then((pdf) => pdf && navigate(`/pdfs/${pdf.id}`)).catch((reason: unknown) => setError(services.describeError(reason)))}>Importar PDF</button>
      </div>
      {error ? <p className="save-bad">{error}</p> : null}
      {pdfs.length === 0 ? (
        <EmptyState title="Nenhum PDF na biblioteca" body="Importe um arquivo pelo botão ou arraste um PDF para esta área. O original fica no armazenamento do aplicativo e as marcações são guardadas à parte." action="Importar PDF" onAction={() => void importPdf(services, desktop).then((pdf) => pdf && navigate(`/pdfs/${pdf.id}`))} />
      ) : (
        <div className="stack">
          {pdfs.map((pdf) => (
            <button key={pdf.id} type="button" className="list-card" onClick={() => navigate(`/pdfs/${pdf.id}`)}>
              <span>
                <strong>{pdf.title}</strong>
                <small className="meta">{subjects.find((subject) => subject.id === pdf.subjectId)?.name ?? "Sem matéria"} · {formatSize(pdf.sizeBytes)} · {pdf.pageCount || "—"} páginas · página {pdf.progressPage}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PdfReaderPage({ detached = false }: { detached?: boolean }) {
  const { services, desktop } = useApp();
  const params = useParams();
  const pdfId = params.pdfId ?? "";
  const [record, setRecord] = useState<PdfDocument | null>(null);
  const [proxy, setProxy] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1.1);
  const [fit, setFit] = useState<"custom" | "width" | "page">("width");
  const [query, setQuery] = useState("");
  const [tool, setTool] = useState<"select" | "highlight" | "underline" | "comment" | "freehand">("select");
  const [color, setColor] = useState<(typeof HIGHLIGHT_COLORS)[number]>(HIGHLIGHT_COLORS[0]);
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [textNotice, setTextNotice] = useState("");
  const [commentDraft, setCommentDraft] = useState<{ page: number; rects: NormRect[]; text: string; comment: string } | null>(null);
  const [selectionDraft, setSelectionDraft] = useState<{ page: number; text: string; question: string; answer: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dataEpoch = useUiStore((state) => state.dataEpoch);

  useEffect(() => {
    let cancelled = false;
    let loading: PDFDocumentProxy | null = null;
    void (async () => {
      const next = await services.pdfs.get(pdfId);
      if (!next) {
        setError("Documento não encontrado.");
        return;
      }
      setRecord(next);
      setPage(next.bookmarkPage ?? next.progressPage ?? 1);
      const exists = await desktop.exists(next.relativePath);
      if (!exists) {
        setError("O arquivo interno deste PDF não foi encontrado. Importe o documento outra vez.");
        return;
      }
      const bytes = await services.pdfs.read(next.id);
      try {
        const task = getDocument({ data: bytes.slice(0) });
        loading = await task.promise;
        if (cancelled) {
          await loading.cleanup();
          return;
        }
        setProxy(loading);
        setAnnotations(await services.pdfs.annotations(next.id));
        let hasText = false;
        const sample = await loading.getPage(1);
        const text = await sample.getTextContent();
        hasText = text.items.length > 0;
        setTextNotice(hasText ? "" : "Este PDF não tem camada de texto. A pesquisa e a cópia ficam indisponíveis; marcações visuais continuam possíveis.");
        await services.pdfs.updateProgress(next.id, next.progressPage || 1, loading.numPages, hasText);
      } catch (reason) {
        if (reason instanceof PasswordException || (reason as { name?: string }).name === "PasswordException") {
          setError("Este PDF está protegido por senha. O ZenStudies não remove proteção.");
        } else setError("Não foi possível abrir este PDF. O arquivo pode estar corrompido.");
      }
    })();
    return () => {
      cancelled = true;
      void loading?.cleanup();
    };
  }, [dataEpoch, desktop, pdfId, services]);

  const pages = proxy?.numPages ?? record?.pageCount ?? 0;
  const pageNumbers = useMemo(() => Array.from({ length: pages }, (_, index) => index + 1), [pages]);

  async function addFromSelection(pageNumber: number, rects: NormRect[], text: string) {
    if (!record) return;
    if (tool === "comment") {
      setCommentDraft({ page: pageNumber, rects, text, comment: "" });
      return;
    }
    const annotation = await services.pdfs.saveAnnotation({
      pdfId: record.id,
      page: pageNumber,
      type: tool === "underline" ? "underline" : "highlight",
      color,
      rects,
      points: [],
      selectedText: text || null,
      comment: null,
      noteId: null,
      cardId: null,
    });
    setAnnotations((current) => [...current.filter((item) => item.id !== annotation.id), annotation]);
  }

  return (
    <div className="pdf-shell">
      <aside className="pdf-thumbs" aria-label="Miniaturas">
        {pageNumbers.map((number) => (
          <button key={number} type="button" aria-current={number === page ? "page" : undefined} onClick={() => {
            setPage(number);
            document.getElementById(`pdf-page-${number}`)?.scrollIntoView({ block: "start" });
          }}>
            {proxy ? <Thumbnail pdf={proxy} pageNumber={number} /> : number}
          </button>
        ))}
      </aside>
      <section>
        <div className="pdf-toolbar">
          <button type="button" className="button secondary" onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</button>
          <label className="meta">Página <input aria-label="Número da página" style={{ width: 64 }} value={page} onChange={(event) => setPage(Math.min(pages || 1, Math.max(1, Number(event.target.value) || 1)))} /></label>
          <button type="button" className="button secondary" onClick={() => setPage((value) => Math.min(pages || value, value + 1))}>Próxima</button>
          <button type="button" className="button secondary" onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))}>−</button>
          <button type="button" className="button secondary" onClick={() => setZoom((value) => Math.min(3, value + 0.1))}>+</button>
          <button type="button" className="button secondary" onClick={() => setFit("width")}>Ajustar à largura</button>
          <button type="button" className="button secondary" onClick={() => setFit("page")}>Ajustar à página</button>
          <button type="button" className="button secondary" onClick={() => record && void services.pdfs.setBookmark(record.id, page)}>Marcar página</button>
          {(["select", "highlight", "underline", "comment", "freehand"] as const).map((item) => (
            <button key={item} type="button" className="button secondary" aria-pressed={tool === item} onClick={() => setTool(item)}>{TOOL_LABELS[item]}</button>
          ))}
          {HIGHLIGHT_COLORS.map((item) => (
            <button key={item} type="button" className="color-dot" style={{ background: item }} aria-label={`Cor ${item}`} aria-pressed={color === item} onClick={() => setColor(item)} />
          ))}
          <input aria-label="Pesquisar no PDF" placeholder={textNotice ? "Sem camada de texto" : "Pesquisar"} disabled={Boolean(textNotice)} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && proxy) void findText(proxy, query).then((found) => { if (found) { setPage(found); document.getElementById(`pdf-page-${found}`)?.scrollIntoView({ block: "start" }); } });
          }} />
          {!detached && record ? <button type="button" className="button secondary" onClick={() => void desktop.openWindow({ label: `pdf-${record.id}`, route: `/janela/pdf/${record.id}`, title: record.title, width: 1100, height: 800 })}>Destacar</button> : null}
        </div>
        {error ? <div className="today-main"><h2>PDF indisponível</h2><p>{error}</p></div> : null}
        {textNotice ? <p className="today-main meta">{textNotice}</p> : null}
        <div className="pdf-scroll" ref={scrollRef} onScroll={() => {
          const container = scrollRef.current;
          if (!container || !record) return;
          const nodes = [...container.querySelectorAll<HTMLElement>("[data-page]")];
          const current = nodes.find((node) => node.getBoundingClientRect().bottom > container.getBoundingClientRect().top + 40);
          const number = Number(current?.dataset.page ?? page);
          if (number && number !== page) {
            setPage(number);
            void services.pdfs.updateProgress(record.id, number, pages, !textNotice);
          }
        }}>
          {proxy ? pageNumbers.map((number) => (
            <PdfPageView
              key={number}
              pdf={proxy}
              pageNumber={number}
              zoom={zoom}
              fit={fit}
              containerWidth={scrollRef.current?.clientWidth ?? 800}
              containerHeight={scrollRef.current?.clientHeight ?? 700}
              annotations={annotations.filter((item) => item.page === number)}
              tool={tool}
              color={color}
              onAnnotate={(rects, text) => void addFromSelection(number, rects, text)}
              onFreehand={async (points) => {
                if (!record) return;
                const annotation = await services.pdfs.saveAnnotation({ pdfId: record.id, page: number, type: "freehand", color, rects: [], points, selectedText: null, comment: null, noteId: null, cardId: null });
                setAnnotations((current) => [...current, annotation]);
              }}
              onCreateCard={(text) => {
                if (!record) return;
                setSelectionDraft({ page: number, text, question: text.slice(0, 180), answer: text });
              }}
            />
          )) : null}
        </div>
      </section>
      <TextDialog
        open={Boolean(commentDraft)}
        title="Comentário"
        confirmLabel="Guardar"
        fields={(
          <label className="field">
            <span>Texto</span>
            <textarea value={commentDraft?.comment ?? ""} onChange={(event) => setCommentDraft((current) => current ? { ...current, comment: event.target.value } : current)} />
          </label>
        )}
        onCancel={() => setCommentDraft(null)}
        onConfirm={() => {
          if (!commentDraft || !record || !commentDraft.comment.trim()) return;
          void services.pdfs.saveAnnotation({
            pdfId: record.id,
            page: commentDraft.page,
            type: "comment",
            color,
            rects: commentDraft.rects,
            points: [],
            selectedText: commentDraft.text || null,
            comment: commentDraft.comment,
            noteId: null,
            cardId: null,
          }).then((annotation) => {
            setAnnotations((current) => [...current, annotation]);
            setCommentDraft(null);
          });
        }}
      />
      <TextDialog
        open={Boolean(selectionDraft)}
        title="Nota ou cartão a partir do PDF"
        body="A seleção vira uma nota nesta matéria. O cartão é opcional e fica ligado à página."
        confirmLabel="Criar nota e cartão"
        fields={(
          <>
            <label className="field"><span>Pergunta</span><textarea value={selectionDraft?.question ?? ""} onChange={(event) => setSelectionDraft((current) => current ? { ...current, question: event.target.value } : current)} /></label>
            <label className="field"><span>Resposta</span><textarea value={selectionDraft?.answer ?? ""} onChange={(event) => setSelectionDraft((current) => current ? { ...current, answer: event.target.value } : current)} /></label>
            <button type="button" className="button secondary" onClick={() => {
              if (!selectionDraft || !record) return;
              void services.notes.create({ title: record.title, text: selectionDraft.text, subjectId: record.subjectId }).then(() => setSelectionDraft(null));
            }}>Só a nota</button>
          </>
        )}
        onCancel={() => setSelectionDraft(null)}
        onConfirm={() => {
          if (!selectionDraft || !record || !selectionDraft.question.trim() || !selectionDraft.answer.trim()) return;
          void services.notes.create({ title: record.title, text: selectionDraft.text, subjectId: record.subjectId }).then((note) =>
            services.cards.create({
              noteId: note.id,
              question: selectionDraft.question,
              answer: selectionDraft.answer,
              sourcePdfId: record.id,
              sourcePage: selectionDraft.page,
            }),
          ).then(() => setSelectionDraft(null));
        }}
      />
    </div>
  );
}

const TOOL_LABELS = {
  select: "Selecionar",
  highlight: "Destaque",
  underline: "Sublinhado",
  comment: "Comentário",
  freehand: "Livre",
} as const;

function PdfPageView({
  pdf, pageNumber, zoom, fit, containerWidth, containerHeight, annotations, tool, onAnnotate, onFreehand, onCreateCard,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  fit: "custom" | "width" | "page";
  containerWidth: number;
  containerHeight: number;
  annotations: PdfAnnotation[];
  tool: string;
  color: string;
  onAnnotate: (rects: NormRect[], text: string) => void;
  onFreehand: (points: { x: number; y: number }[]) => void;
  onCreateCard: (text: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(pageNumber < 3);
  const [size, setSize] = useState({ width: 600, height: 800 });
  const drawing = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "600px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const widthScale = Math.max(0.4, (containerWidth - 48) / base.width);
      const pageScale = Math.min(widthScale, Math.max(0.4, (containerHeight - 48) / base.height));
      const scale = fit === "width" ? widthScale : fit === "page" ? pageScale : zoom;
      const viewport = page.getViewport({ scale });
      if (!canvasRef.current || cancelled) return;
      const context = canvasRef.current.getContext("2d");
      if (!context) return;
      const outputScale = window.devicePixelRatio || 1;
      canvasRef.current.width = Math.floor(viewport.width * outputScale);
      canvasRef.current.height = Math.floor(viewport.height * outputScale);
      canvasRef.current.style.width = `${viewport.width}px`;
      canvasRef.current.style.height = `${viewport.height}px`;
      setSize({ width: viewport.width, height: viewport.height });
      await page.render({ canvas: canvasRef.current, canvasContext: context, viewport, transform: [outputScale, 0, 0, outputScale, 0, 0] }).promise;
      if (!textRef.current || cancelled) return;
      textRef.current.replaceChildren();
      const text = await page.getTextContent();
      const { TextLayer } = await import("pdfjs-dist");
      const layer = new TextLayer({ textContentSource: text, container: textRef.current, viewport });
      await layer.render();
    })();
    return () => { cancelled = true; };
  }, [containerHeight, containerWidth, fit, pageNumber, pdf, visible, zoom]);

  return (
    <div id={`pdf-page-${pageNumber}`} data-page={pageNumber} ref={wrapRef} className="pdf-page" style={{ width: size.width, height: size.height }}
      onPointerUp={() => {
        if (tool === "freehand" && drawing.current.length > 1) onFreehand(drawing.current);
        drawing.current = [];
        if (tool === "select" || tool === "highlight" || tool === "underline" || tool === "comment") {
          const selection = window.getSelection();
          if (!selection || selection.isCollapsed || !wrapRef.current) return;
          const box = wrapRef.current.getBoundingClientRect();
          const rects = [...selection.getRangeAt(0).getClientRects()].map((rect) => normalizeRect({
            x: (rect.left - box.left) / box.width,
            y: (rect.top - box.top) / box.height,
            w: rect.width / box.width,
            h: rect.height / box.height,
          })).filter((rect): rect is NormRect => rect !== null);
          if (tool !== "select" && rects.length) onAnnotate(rects, selection.toString());
        }
      }}
      onPointerDown={(event) => {
        if (tool !== "freehand" || !wrapRef.current) return;
        const box = wrapRef.current.getBoundingClientRect();
        drawing.current = [{ x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }];
      }}
      onPointerMove={(event) => {
        if (tool !== "freehand" || drawing.current.length === 0 || !wrapRef.current) return;
        const box = wrapRef.current.getBoundingClientRect();
        drawing.current.push({ x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height });
      }}
    >
      <canvas ref={canvasRef} />
      <div ref={textRef} className="textLayer" />
      {annotations.map((annotation) => (
        <div key={annotation.id}>
          {annotation.rects.map((rect, index) => (
            <div key={index} className={`pdf-ann ${annotation.type}`} style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%`, ["--ann" as string]: annotation.color }} title={annotation.comment ?? annotation.selectedText ?? ""} />
          ))}
          {annotation.type === "freehand" ? <svg className="pdf-ann" viewBox="0 0 1 1" preserveAspectRatio="none" style={{ inset: 0, width: "100%", height: "100%" }}><polyline fill="none" stroke={annotation.color} strokeWidth="0.004" points={annotation.points.map((point) => `${point.x},${point.y}`).join(" ")} /></svg> : null}
        </div>
      ))}
      <button type="button" className="button secondary" style={{ position: "absolute", right: 8, bottom: 8 }} onClick={() => {
        const text = window.getSelection()?.toString() ?? "";
        if (text) onCreateCard(text);
      }}>Criar nota ou cartão</button>
    </div>
  );
}

function Thumbnail({ pdf, pageNumber }: { pdf: PDFDocumentProxy; pageNumber: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "200px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 0.18 });
      if (!ref.current || cancelled) return;
      const context = ref.current.getContext("2d");
      if (!context) return;
      ref.current.width = viewport.width;
      ref.current.height = viewport.height;
      await page.render({ canvas: ref.current, canvasContext: context, viewport }).promise;
    })();
    return () => { cancelled = true; };
  }, [pageNumber, pdf, visible]);
  return <canvas ref={ref} aria-label={`Miniatura da página ${pageNumber}`} />;
}

async function findText(pdf: PDFDocumentProxy, query: string): Promise<number | null> {
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  if (!needle) return null;
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ").toLocaleLowerCase("pt-BR");
    if (text.includes(needle)) return number;
  }
  return null;
}

async function dropPdf(event: DragEvent, services: ReturnType<typeof useApp>["services"]) {
  event.preventDefault();
  const file = [...event.dataTransfer.files].find((item) => item.type === "application/pdf" || item.name.toLowerCase().endsWith(".pdf"));
  if (!file) return null;
  return services.pdfs.importBytes(file.name, new Uint8Array(await file.arrayBuffer()));
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
