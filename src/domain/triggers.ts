export interface TriggerMatch {
  query: string;
  from: number;
}

export function detectSlash(textBefore: string): TriggerMatch | null {
  const match = /(?:^|\s)\/([^\s/]*)$/.exec(textBefore);
  if (!match) return null;
  const query = match[1] ?? "";
  return { query, from: textBefore.length - query.length - 1 };
}

export function detectWiki(textBefore: string): TriggerMatch | null {
  const match = /\[\[([^\]\n]*)$/.exec(textBefore);
  if (!match) return null;
  const query = match[1] ?? "";
  return { query, from: textBefore.length - query.length - 2 };
}

export const BLOCK_COMMANDS = [
  { id: "paragraph", label: "Parágrafo", keywords: "texto" },
  { id: "heading", label: "Título", keywords: "heading" },
  { id: "bullet", label: "Lista", keywords: "marcadores" },
  { id: "ordered", label: "Lista numerada", keywords: "numero" },
  { id: "task", label: "Tarefa", keywords: "checkbox" },
  { id: "quote", label: "Citação", keywords: "quote" },
  { id: "code", label: "Código", keywords: "code" },
  { id: "image", label: "Imagem", keywords: "anexo foto" },
  { id: "audio", label: "Áudio", keywords: "som" },
  { id: "rule", label: "Divisor", keywords: "linha" },
] as const;

export type BlockCommandId = (typeof BLOCK_COMMANDS)[number]["id"];

export function filterCommands(query: string) {
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  return BLOCK_COMMANDS.filter((command) => !needle || `${command.label} ${command.keywords}`.toLocaleLowerCase("pt-BR").includes(needle));
}
