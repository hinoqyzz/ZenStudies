import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../app/context";
import { loadPreferences, resolveTheme, savePreferences } from "../../domain/preferences";
import { importPdf } from "../pdf/import-pdf";
import { useUiStore } from "../../stores/ui-store";

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { services, desktop } = useApp();
  const navigate = useNavigate();
  const setInspector = useUiStore((state) => state.setInspectorCollapsed);
  const inspector = useUiStore((state) => state.inspectorCollapsed);
  const setSidebar = useUiStore((state) => state.setSidebarCollapsed);
  const sidebar = useUiStore((state) => state.sidebarCollapsed);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ id: string; kind: string; title: string; detail: string }[]>([]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void services.search(query).then(setHits);
    }, 80);
    return () => window.clearTimeout(handle);
  }, [query, services]);

  const commands = [
    { label: "Ir para Hoje", run: () => navigate("/") },
    { label: "Criar nota", run: () => void services.notes.create().then((note) => navigate(`/notas/${note.id}`)) },
    { label: "Abrir PDF", run: () => void importPdf(services, desktop).then((pdf) => { if (pdf) navigate(`/pdfs/${pdf.id}`); }) },
    { label: "Iniciar revisão", run: () => navigate("/revisoes/sessao") },
    { label: "Captura rápida", run: () => void desktop.openWindow({ label: "capture", route: "/captura", title: "Captura rápida", width: 520, height: 420 }) },
    { label: sidebar ? "Expandir sidebar" : "Recolher sidebar", run: () => {
      const next = !sidebar;
      setSidebar(next);
      savePreferences({ ...loadPreferences(), sidebarCollapsed: next });
    } },
    { label: inspector ? "Expandir inspector" : "Recolher inspector", run: () => {
      const next = !inspector;
      setInspector(next);
      savePreferences({ ...loadPreferences(), inspectorCollapsed: next });
    } },
    {
      label: "Alternar tema",
      run: () => {
        const preferences = loadPreferences();
        const next = preferences.theme === "dark" ? "light" : "dark";
        savePreferences({ ...preferences, theme: next });
        document.documentElement.dataset.theme = resolveTheme(next, false);
      },
    },
    { label: "Abrir configurações", run: () => navigate("/configuracoes") },
  ].filter((command) => command.label.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-mask" />
        <Dialog.Content className="palette dialog">
          <Dialog.Title className="sr-only">Comandos</Dialog.Title>
          <Dialog.Description className="sr-only">Buscar notas ou executar um comando.</Dialog.Description>
        <input data-shortcut-scope="palette" autoFocus placeholder="Buscar ou executar um comando" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} />
        <div className="palette-list">
          {commands.map((command) => (
            <button key={command.label} type="button" className="menu-item" onClick={() => { command.run(); onClose(); }}>{command.label}</button>
          ))}
          {hits.map((hit) => (
            <button
              key={`${hit.kind}-${hit.id}`}
              type="button"
              className="menu-item"
              onClick={() => {
                if (hit.kind === "note") navigate(`/notas/${hit.id}`);
                if (hit.kind === "pdf") navigate(`/pdfs/${hit.id}`);
                if (hit.kind === "subject") navigate(`/notas?materia=${hit.id}`);
                if (hit.kind === "card") navigate("/revisoes");
                onClose();
              }}
            >
              {hit.title}
              <small className="meta"> {hit.detail}</small>
            </button>
          ))}
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
