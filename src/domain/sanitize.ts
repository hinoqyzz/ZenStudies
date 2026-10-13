function controlExpression(excluded: number[] = []): RegExp {
  const skip = new Set(excluded);
  const parts: string[] = [];
  for (let code = 0; code <= 31; code += 1) {
    if (!skip.has(code)) parts.push(`\\u${code.toString(16).padStart(4, "0")}`);
  }
  parts.push("\\u007f");
  return new RegExp(`[${parts.join("")}]`, "g");
}

const CONTROL = controlExpression();
const MULTILINE_CONTROL = controlExpression([9, 10, 13]);

export function cleanTitle(input: string, fallback = "Sem título"): string {
  const cleaned = input.replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, 200);
}

export function cleanPlain(input: string, max = 8000): string {
  return input.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function cleanMultiline(input: string, max = 20000): string {
  return input.replace(MULTILINE_CONTROL, "").slice(0, max);
}

export function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

export function fileBaseName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "arquivo";
  return base.replace(CONTROL, "").replace(/^\.+/, "").slice(0, 180) || "arquivo";
}
