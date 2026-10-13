export interface ShortcutDefinition {
  id: string;
  keys: string;
  label: string;
  scope: "global" | "review" | "editor";
}

export const SHORTCUTS: ShortcutDefinition[] = [
  { id: "palette", keys: "Ctrl+K", label: "Buscar e comandos", scope: "global" },
  { id: "new-note", keys: "Ctrl+N", label: "Nova nota", scope: "global" },
  { id: "capture", keys: "Ctrl+Shift+N", label: "Captura rápida", scope: "global" },
  { id: "open-pdf", keys: "Ctrl+O", label: "Importar PDF", scope: "global" },
  { id: "escape", keys: "Esc", label: "Fechar overlay ou sair da revisão", scope: "global" },
  { id: "peek", keys: "Espaço", label: "Pré-visualizar item da lista", scope: "global" },
  { id: "show-answer", keys: "Espaço", label: "Mostrar resposta", scope: "review" },
  { id: "again", keys: "1", label: "Ainda não", scope: "review" },
  { id: "hard", keys: "2", label: "Quase", scope: "review" },
  { id: "good", keys: "3", label: "Lembrei", scope: "review" },
  { id: "bold", keys: "Ctrl+B", label: "Negrito", scope: "editor" },
  { id: "italic", keys: "Ctrl+I", label: "Itálico", scope: "editor" },
];

export function findShortcutConflicts(definitions: ShortcutDefinition[]): [ShortcutDefinition, ShortcutDefinition][] {
  const conflicts: [ShortcutDefinition, ShortcutDefinition][] = [];
  for (let index = 0; index < definitions.length; index += 1) {
    for (let next = index + 1; next < definitions.length; next += 1) {
      const left = definitions[index];
      const right = definitions[next];
      if (left.keys === right.keys && left.scope === right.scope) conflicts.push([left, right]);
    }
  }
  return conflicts;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest("[contenteditable='true'], .ProseMirror, [data-editor-root='true']")) return true;
  return false;
}

export function shouldIgnoreGlobalShortcut(target: EventTarget | null, composing: boolean): boolean {
  if (composing) return true;
  return isTypingTarget(target);
}
