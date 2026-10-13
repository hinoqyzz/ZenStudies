import { createStudyServices, type StudyServices } from "../application/services";
import { MemoryGateway } from "../desktop/memory-gateway";
import { MemorySyncChannel, SyncBus } from "../desktop/sync-bus";
import { createId } from "../domain/ids";
import { createDatabase, type ZenDatabase } from "../repositories/dexie/database";
import { DexieStudyRepository } from "../repositories/dexie/dexie-repository";

export interface TestStack {
  database: ZenDatabase;
  repository: DexieStudyRepository;
  desktop: MemoryGateway;
  sync: SyncBus;
  services: StudyServices;
  close: () => void;
}

export async function openStack(): Promise<TestStack> {
  const database = createDatabase(`zen-test-${createId()}`);
  await database.open();
  const repository = new DexieStudyRepository(database);
  const desktop = new MemoryGateway();
  const sync = new SyncBus(createId(), new MemorySyncChannel());
  const services = createStudyServices(repository, desktop, sync);
  await services.ready();
  return {
    database,
    repository,
    desktop,
    sync,
    services,
    close: () => database.close(),
  };
}

export function pngBytes(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
}

export function pdfBytes(): Uint8Array {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
}
