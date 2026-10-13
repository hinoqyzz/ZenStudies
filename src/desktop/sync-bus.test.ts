import { describe, expect, it } from "vitest";
import { MemorySyncChannel, SyncBus, type SyncEvent } from "./sync-bus";

describe("sincronização entre janelas", () => {
  it("entrega o evento à outra janela e ignora o eco local", () => {
    const channel = new MemorySyncChannel();
    const left = new SyncBus("janela-a", channel);
    const right = new SyncBus("janela-b", channel);
    const remote: SyncEvent[] = [];
    const local: SyncEvent[] = [];
    right.subscribe((event) => remote.push(event));
    left.subscribe((event) => remote.push(event));
    left.onLocal((event) => local.push(event));
    left.publish({ type: "notes", id: "nota-1" });
    expect(local).toHaveLength(1);
    expect(remote).toEqual([{ type: "notes", id: "nota-1", sourceId: "janela-a" }]);
  });

  it("republica pelo canal de saída sem alterar a origem", () => {
    const channel = new MemorySyncChannel();
    const bus = new SyncBus("janela-a", channel);
    const outbound: SyncEvent[] = [];
    bus.bindOutbound((event) => outbound.push(event));
    bus.publish({ type: "pdfs", id: "pdf-1" });
    expect(outbound[0]?.sourceId).toBe("janela-a");
  });
});
