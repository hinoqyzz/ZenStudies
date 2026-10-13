import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { BookOpen, CalendarDays, FileText, Library, PanelLeft, RefreshCcw, Settings, StickyNote } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../../app/context";
import { shouldIgnoreGlobalShortcut } from "../../domain/shortcuts";
import { loadPreferences, savePreferences } from "../../domain/preferences";
import { useUiStore } from "../../stores/ui-store";
import { SymbolMark } from "../../ui/Symbol";
import { IconTip } from "../../ui/components";
import { importPdf } from "../pdf/import-pdf";
import { CommandPalette } from "./CommandPalette";

gsap.registerPlugin(useGSAP);

const LINKS = [
  { to: "/", label: "Hoje", icon: CalendarDays },
  { to: "/notas", label: "Notas", icon: StickyNote },
  { to: "/revisoes", label: "Revisões", icon: RefreshCcw },
  { to: "/biblioteca", label: "Biblioteca", icon: Library },
  { to: "/pdfs", label: "PDFs", icon: BookOpen },
];

export function Shell() {
  const { services, desktop } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [subjects, setSubjects] = useState<{ id: string; name: string; color: string }[]>([]);
  const [width, setWidth] = useState(window.innerWidth);
  const collapsedPref = useUiStore((state) => state.sidebarCollapsed);
  const setCollapsed = useUiStore((state) => state.setSidebarCollapsed);
  const commandOpen = useUiStore((state) => state.setCommandOpen);
  const open = useUiStore((state) => state.commandOpen);
  const toasts = useUiStore((state) => state.toasts);
  const dismissToast = useUiStore((state) => state.dismissToast);
  const peek = useUiStore((state) => state.peekNoteId);
  const setPeek = useUiStore((state) => state.setPeekNoteId);
  const forced = width < 1080;
  const collapsed = forced || collapsedPref;
  const dataEpoch = useUiStore((state) => state.dataEpoch);
  const shellRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const node = shellRef.current;
    if (!node) return;
    const target = collapsed ? "68px" : "232px";
    if (document.documentElement.dataset.motion !== "full") {
      node.style.setProperty("--sidebar-current", target);
      return;
    }
    gsap.to(node, { "--sidebar-current": target, duration: 0.22, ease: "power2.out" });
  }, { dependencies: [collapsed] });

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    void services.subjects.list().then(setSubjects);
    return services ? undefined : undefined;
  }, [dataEpoch, services, location.pathname]);

  useEffect(() => {
    let composing = false;
    const onCompositionStart = () => {
      composing = true;
    };
    const onCompositionEnd = () => {
      composing = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const paletteField = event.target instanceof HTMLElement && event.target.dataset.shortcutScope === "palette";
      const blocked = shouldIgnoreGlobalShortcut(event.target, composing) && !paletteField;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "k" && !blocked) {
        event.preventDefault();
        commandOpen(!useUiStore.getState().commandOpen);
      } else if (mod && event.key.toLowerCase() === "n" && !event.shiftKey && !blocked) {
        event.preventDefault();
        void services.notes.create().then((note) => navigate(`/notas/${note.id}`));
      } else if (mod && event.shiftKey && event.key.toLowerCase() === "n" && !blocked) {
        event.preventDefault();
        void desktop.openWindow({ label: "capture", route: "/captura", title: "Captura rápida", width: 520, height: 420 });
      } else if (mod && event.key.toLowerCase() === "o" && !blocked) {
        event.preventDefault();
        void importPdf(services, desktop).then((pdf) => {
          if (pdf) navigate(`/pdfs/${pdf.id}`);
        });
      } else if (event.key === "Escape" && !blocked) {
        if (useUiStore.getState().commandOpen) commandOpen(false);
        else if (useUiStore.getState().peekNoteId) setPeek(null);
      } else if (event.code === "Space" && !blocked && event.target instanceof HTMLElement && event.target.dataset.peekId && !event.repeat) {
        event.preventDefault();
        setPeek(event.target.dataset.peekId ?? null);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setPeek(null);
    };
    window.addEventListener("compositionstart", onCompositionStart);
    window.addEventListener("compositionend", onCompositionEnd);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("compositionstart", onCompositionStart);
      window.removeEventListener("compositionend", onCompositionEnd);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [commandOpen, desktop, navigate, services, setPeek]);

  const title = LINKS.find((link) => (link.to === "/" ? location.pathname === "/" : location.pathname.startsWith(link.to)))?.label ?? "ZenStudies";

  return (
    <div ref={shellRef} className="shell" data-sidebar={collapsed ? "collapsed" : "open"}>
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="ZenStudies">
          <SymbolMark size={34} title="ZenStudies" />
          <strong>ZenStudies</strong>
        </NavLink>
        <nav className="nav-list" aria-label="Principal">
          {LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink key={link.to} to={link.to} end={link.to === "/"} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                <Icon size={18} aria-hidden="true" />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="nav-section">Matérias</div>
        {subjects.map((subject) => (
          <button key={subject.id} type="button" className="subject-link" onClick={() => navigate(`/notas?materia=${subject.id}`)}>
            <i className="subject-dot" style={{ background: subject.color }} />
            <span>{subject.name}</span>
          </button>
        ))}
        <div className="sidebar-spacer" />
        <NavLink to="/configuracoes" className="sidebar-foot">
          <Settings size={16} aria-hidden="true" />
          <span>Configurações</span>
        </NavLink>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <IconTip label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}>
            <button
              type="button"
              className="icon-button"
              aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
              onClick={() => {
                const next = !collapsedPref;
                setCollapsed(next);
                const preferences = loadPreferences();
                savePreferences({ ...preferences, sidebarCollapsed: next });
              }}
            >
              <PanelLeft size={18} />
            </button>
          </IconTip>
          <h1>{title}</h1>
          <button type="button" className="search-button" onClick={() => commandOpen(true)}>
            <FileText size={16} aria-hidden="true" />
            Buscar notas, matérias ou comandos
            <span className="kbd">Ctrl K</span>
          </button>
        </header>
        <div className="page">
          <Outlet />
        </div>
      </div>
      {open ? <CommandPalette onClose={() => commandOpen(false)} /> : null}
      {peek ? <PeekNote id={peek} onClose={() => setPeek(null)} /> : null}
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            {toast.actionLabel ? (
              <button type="button" onClick={() => { toast.onAction?.(); dismissToast(toast.id); }}>{toast.actionLabel}</button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function PeekNote({ id, onClose }: { id: string; onClose: () => void }) {
  const { services } = useApp();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  useEffect(() => {
    void services.notes.get(id).then((note) => {
      setTitle(note?.title ?? "Nota");
      setText(note?.text ?? "");
    });
  }, [id, services]);
  return (
    <div className="peek" role="dialog" aria-label="Pré-visualização" style={{ position: "fixed", right: 24, bottom: 24, width: 360, padding: 16, zIndex: 25 }}>
      <strong>{title}</strong>
      <p>{text.slice(0, 280) || "Nota vazia."}</p>
      <button type="button" className="button secondary" onClick={onClose}>Fechar</button>
    </div>
  );
}

