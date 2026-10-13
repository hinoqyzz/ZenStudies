import { describe, expect, it } from "vitest";
import { isTypingTarget, shouldIgnoreGlobalShortcut } from "./shortcuts";

describe("atalhos durante a digitação", () => {
  it("ignora o atalho global em campo, editor e composição", () => {
    const input = document.createElement("input");
    const editor = document.createElement("div");
    editor.className = "ProseMirror";
    const paragraph = document.createElement("p");
    editor.append(paragraph);
    document.body.append(input, editor);
    expect(shouldIgnoreGlobalShortcut(input, false)).toBe(true);
    expect(shouldIgnoreGlobalShortcut(paragraph, false)).toBe(true);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(shouldIgnoreGlobalShortcut(document.body, true)).toBe(true);
    expect(shouldIgnoreGlobalShortcut(document.body, false)).toBe(false);
  });
});
