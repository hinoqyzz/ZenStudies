import { describe, expect, it } from "vitest";
import { AutosaveController, AutosaveQueue } from "./autosave";

describe("autosave", () => {
  it("grava só o texto mais recente depois do debounce", async () => {
    const saved: string[] = [];
    const controller = new AutosaveController({
      noteId: "nota",
      delayMs: 600,
      schedule: () => 1,
      cancel: () => undefined,
      persist: async (snapshot) => {
        saved.push(snapshot.text);
      },
    });
    controller.push(snapshot("primeiro"));
    controller.push(snapshot("segundo"));
    expect(saved).toEqual([]);
    await controller.flush();
    expect(saved).toEqual(["segundo"]);
  });

  it("espera a gravação já iniciada e depois grava a mais nova", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const order: string[] = [];
    const queue = new AutosaveQueue();
    const first = queue.enqueue("nota", async () => {
      order.push("inicio");
      await gate;
      order.push("fim");
    });
    await Promise.resolve();
    const second = queue.enqueue("nota", async () => {
      order.push("seguinte");
    });
    release();
    await first;
    await second;
    expect(order).toEqual(["inicio", "fim", "seguinte"]);
  });

  it("mantém o snapshot quando a gravação falha", async () => {
    const statuses: string[] = [];
    const controller = new AutosaveController({
      noteId: "nota",
      delayMs: 500,
      schedule: () => 1,
      cancel: () => undefined,
      persist: async () => {
        throw new Error("cota esgotada");
      },
      onStatus: (status) => statuses.push(status),
    });
    controller.push(snapshot("texto vivo"));
    await expect(controller.flush()).rejects.toThrow("cota esgotada");
    expect(statuses).toEqual(["saving", "error"]);
    expect(controller.hasPending()).toBe(true);
  });
});

function snapshot(text: string) {
  return {
    title: "Título",
    text,
    content: { type: "doc" },
    subjectId: null,
    baseRevision: 1,
  };
}
