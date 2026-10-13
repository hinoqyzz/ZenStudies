import type { RichContent } from "./models";

export function emptyDocument(): RichContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function documentFromText(text: string): RichContent {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim().length > 0);
  if (blocks.length === 0) return emptyDocument();
  return {
    type: "doc",
    content: blocks.map((block) => ({
      type: "paragraph",
      content: [{ type: "text", text: block.trim() }],
    })),
  };
}

export function extractText(content: RichContent | null | undefined): string {
  if (!content) return "";
  const parts: string[] = [];
  const walk = (node: RichContent) => {
    if (node.type === "noteLink" && typeof node.attrs?.title === "string") {
      parts.push(String(node.attrs.title));
    }
    if (node.text) parts.push(node.text);
    if (node.type === "paragraph" || node.type === "heading") parts.push("\n");
    node.content?.forEach(walk);
  };
  walk(content);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

export function collectAttachmentIds(content: RichContent | null | undefined): string[] {
  const ids = new Set<string>();
  const walk = (node: RichContent | null | undefined) => {
    if (!node) return;
    if (
      (node.type === "imageAttachment" || node.type === "audioAttachment") &&
      typeof node.attrs?.attachmentId === "string"
    ) {
      ids.add(node.attrs.attachmentId);
    }
    node.content?.forEach(walk);
  };
  walk(content);
  return [...ids];
}

export function collectNoteLinkIds(content: RichContent | null | undefined): string[] {
  const ids = new Set<string>();
  const walk = (node: RichContent | null | undefined) => {
    if (!node) return;
    if (node.type === "noteLink" && typeof node.attrs?.noteId === "string") {
      ids.add(node.attrs.noteId);
    }
    node.content?.forEach(walk);
  };
  walk(content);
  return [...ids];
}

export function contentSignature(content: RichContent): string {
  return canonicalJson(content);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) sorted[key] = sortValue(source[key]);
    return sorted;
  }
  return value;
}

export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}
