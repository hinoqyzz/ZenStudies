import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import { App } from "./app/App";
import { createStudyServices } from "./application/services";
import { createBrowserSyncChannel, SyncBus, type SyncEvent } from "./desktop/sync-bus";
import { MemoryGateway } from "./desktop/memory-gateway";
import { createTauriGateway, isTauri } from "./desktop/tauri-gateway";
import { createId } from "./domain/ids";
import { createDatabase } from "./repositories/dexie/database";
import { DexieStudyRepository } from "./repositories/dexie/dexie-repository";
import { describePersistenceError } from "./domain/errors";
import { useUiStore } from "./stores/ui-store";
import "./ui/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Não foi possível montar o ZenStudies.");

void bootstrap(root);

async function bootstrap(container: HTMLElement) {
  try {
    const database = createDatabase();
    await database.open();
    const repository = new DexieStudyRepository(database);
    const desktop = isTauri() ? createTauriGateway() : new MemoryGateway();
    const sync = new SyncBus(createId(), createBrowserSyncChannel());
    sync.bindOutbound((event) => {
      if (isTauri()) void desktop.publish(event);
    });
    sync.onLocal(() => useUiStore.getState().bumpData());
    sync.subscribe(() => useUiStore.getState().bumpData());
    if (isTauri()) {
      void desktop.onSync((payload) => {
        const event = payload as SyncEvent;
        if (!event || event.sourceId === sync.id) return;
        useUiStore.getState().bumpData();
      });
    }
    const services = createStudyServices(repository, desktop, sync);
    await services.ready();
    createRoot(container).render(
      <StrictMode>
        <App value={{ services, desktop, sync }} />
      </StrictMode>,
    );
  } catch (error) {
    const message = describePersistenceError(error);
    container.replaceChildren();
    const section = document.createElement("section");
    section.className = "blocking-state";
    const card = document.createElement("div");
    card.className = "blocking-card";
    const title = document.createElement("h1");
    title.textContent = "Banco local indisponível";
    const body = document.createElement("p");
    body.textContent = message;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Tentar de novo";
    button.addEventListener("click", () => window.location.reload());
    card.append(title, body, button);
    section.append(card);
    container.append(section);
  }
}
