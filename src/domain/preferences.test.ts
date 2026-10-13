import { describe, expect, it } from "vitest";
import { loadPreferences, resolveMotion, resolveTheme, sanitizePreferences, savePreferences } from "./preferences";

describe("preferências", () => {
  it("resolve tema e redução de movimento e limita valores fora da faixa", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveMotion("full", true)).toBe("reduced");
    expect(resolveMotion("off", true)).toBe("off");
    expect(resolveMotion("reduced", false)).toBe("reduced");
    const sanitized = sanitizePreferences({ editorFontSize: 99, readingWidth: 10, theme: "dark", motion: "full" });
    expect(sanitized.editorFontSize).toBe(20);
    expect(sanitized.readingWidth).toBe(640);
    expect(sanitized.theme).toBe("dark");
    expect(sanitized.notificationsEnabled).toBe(false);
    expect(sanitized.startWithWindows).toBe(false);
  });

  it("grava e relê o tema no armazenamento local", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
    };
    const next = sanitizePreferences({ ...loadPreferences(storage), theme: "dark", motion: "off" });
    savePreferences(next, storage);
    expect(loadPreferences(storage).theme).toBe("dark");
    expect(loadPreferences(storage).motion).toBe("off");
  });
});
