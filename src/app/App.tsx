import { useEffect, useState } from "react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { HashRouter, Route, Routes, useNavigate } from "react-router-dom";
import { flushAllSaves } from "../application/autosave";
import { focusRemainingMs } from "../domain/focus/clock";
import type { AppContextValue } from "./context";
import { AppProvider, useApp } from "./context";
import { bindServices } from "./registry";
import { loadPreferences, resolveMotion, resolveTheme, savePreferences } from "../domain/preferences";
import { CapturePage } from "../features/capture/CapturePage";
import { LibraryPage } from "../features/library/LibraryPage";
import { NotesPage } from "../features/notes/NotesPage";
import { Onboarding } from "../features/onboarding/Onboarding";
import { PdfLibraryPage, PdfReaderPage } from "../features/pdf/PdfPages";
import { ImmersiveReview, ReviewsPage } from "../features/reviews/ReviewPages";
import { SettingsPage } from "../features/settings/SettingsPage";
import { Preloader } from "../features/shell/Preloader";
import { Shell } from "../features/shell/Shell";
import { TodayPage } from "../features/today/TodayPage";
import { useUiStore } from "../stores/ui-store";
import { TrashPage } from "../features/settings/TrashPage";

export function App({ value }: { value: AppContextValue }) {
  bindServices(value.services);
  const [readyMeta, setReadyMeta] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPreloader, setShowPreloader] = useState(false);
  const replay = useUiStore((state) => state.replayPreloader);
  const setReplay = useUiStore((state) => state.setReplayPreloader);
  const preferences = loadPreferences();
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const systemReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motion = resolveMotion(preferences.motion, systemReduced);

  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(preferences.theme, systemDark);
    document.documentElement.dataset.motion = motion;
    document.documentElement.style.setProperty("--editor-size", `${preferences.editorFontSize}px`);
    document.documentElement.style.setProperty("--reading-width", `${preferences.readingWidth}px`);
    useUiStore.getState().setSidebarCollapsed(preferences.sidebarCollapsed);
    useUiStore.getState().setInspectorCollapsed(preferences.inspectorCollapsed);
    setShowPreloader(!preferences.preloaderSeen);
    void value.services.meta().then((meta) => {
      setShowOnboarding(!meta.onboardingCompleted);
      setReadyMeta(true);
    });
  }, [motion, preferences.editorFontSize, preferences.inspectorCollapsed, preferences.motion, preferences.preloaderSeen, preferences.readingWidth, preferences.sidebarCollapsed, preferences.theme, systemDark, value.services]);

  useEffect(() => {
    const desktop = value.desktop;
    const services = value.services;
    let unlistenClose: (() => void) | undefined;
    let unlistenTray: (() => void) | undefined;
    void desktop.onCloseRequested(() => {
      void closeMain(desktop);
    }).then((stop) => {
      unlistenClose = stop;
    });
    void desktop.onTrayAction((action) => {
      void handleTray(action, services, desktop);
    }).then((stop) => {
      unlistenTray = stop;
    });
    return () => {
      unlistenClose?.();
      unlistenTray?.();
    };
  }, [value.desktop, value.services]);

  return (
    <AppProvider value={value}>
      <TooltipProvider delayDuration={250}>
        <HashRouter>
          <Runtime />
          <Routes>
            <Route path="/captura" element={<CapturePage />} />
            <Route path="/revisoes/sessao" element={<ImmersiveReview />} />
            <Route path="/janela/nota/:noteId" element={<NotesPage detached />} />
            <Route path="/janela/pdf/:pdfId" element={<PdfReaderPage detached />} />
            <Route element={<Shell />}>
              <Route path="/" element={<TodayPage />} />
              <Route path="/notas" element={<NotesPage />} />
              <Route path="/notas/:noteId" element={<NotesPage />} />
              <Route path="/revisoes" element={<ReviewsPage />} />
              <Route path="/biblioteca" element={<LibraryPage />} />
              <Route path="/pdfs" element={<PdfLibraryPage />} />
              <Route path="/pdfs/:pdfId" element={<PdfReaderPage />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
              <Route path="/lixeira" element={<TrashPage />} />
            </Route>
          </Routes>
          {readyMeta && showOnboarding ? <Onboarding onDone={() => setShowOnboarding(false)} /> : null}
          {showPreloader || replay ? (
            <Preloader
              reduced={motion !== "full"}
              onDone={() => {
                const current = loadPreferences();
                savePreferences({ ...current, preloaderSeen: true });
                setShowPreloader(false);
                setReplay(false);
              }}
            />
          ) : null}
        </HashRouter>
      </TooltipProvider>
    </AppProvider>
  );
}

function Runtime() {
  const { services, desktop } = useApp();
  const saveStatus = useUiStore((state) => state.saveStatus);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isMainWindow()) return;
    const timer = window.setInterval(() => {
      void tick(services, desktop);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [desktop, services]);

  useEffect(() => {
    if (saveStatus !== "error") return;
    const preferences = loadPreferences();
    if (!preferences.notificationsEnabled || !preferences.notifySaveFailure) return;
    void desktop.isMainVisible().then((visible) => {
      if (!visible) void desktop.notify("Não foi possível salvar", "O texto atual foi mantido no ZenStudies.");
    });
  }, [desktop, saveStatus]);

  useEffect(() => {
    const onTray = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === "settings") navigate("/configuracoes");
      if (action === "review") navigate("/revisoes/sessao");
      if (action === "focus") navigate("/");
    };
    window.addEventListener("zenstudies-tray", onTray);
    return () => window.removeEventListener("zenstudies-tray", onTray);
  }, [navigate]);

  return null;
}

async function tick(services: AppContextValue["services"], desktop: AppContextValue["desktop"]) {
  const preferences = loadPreferences();
  const focus = await services.focus.current();
  if (focus?.status === "active" && focusRemainingMs(focus, new Date()) <= 0) {
    await services.focus.finish(focus.id, { notify: preferences.notificationsEnabled && preferences.notifyFocusEnd });
  }
  if (!preferences.notificationsEnabled || !preferences.reviewEnabled || !preferences.notifyReviews) return;
  const now = new Date();
  if (now.getHours() !== preferences.reviewHour || now.getMinutes() !== preferences.reviewMinute) return;
  const stamp = now.toDateString();
  if (localStorage.getItem("zenstudies.reviewNotifiedOn") === stamp) return;
  const due = await services.cards.due(now);
  if (due.length === 0) return;
  await desktop.notify("Revisões de hoje", `${due.length} cartões estão prontos.`);
  localStorage.setItem("zenstudies.reviewNotifiedOn", stamp);
}

async function closeMain(desktop: AppContextValue["desktop"]) {
  const result = await flushAllSaves();
  const preferences = loadPreferences();
  if (result.failed) {
    const text = useUiStore.getState().unsavedText;
    const copy = window.confirm(`${result.message}\n\nO texto não salvo continua na nota. Deseja copiá-lo e manter o ZenStudies aberto?`);
    if (copy) {
      await navigator.clipboard.writeText(text).catch(() => undefined);
      await desktop.showMain();
      return;
    }
  }
  if (preferences.closeToTray) {
    if (!preferences.closeToTrayExplained) {
      window.alert("A janela vai para a bandeja e o processo continua. Use Sair completamente para encerrar.");
      savePreferences({ ...preferences, closeToTrayExplained: true });
    }
    await desktop.hideMain();
    return;
  }
  await desktop.quit();
}

async function handleTray(action: string, services: AppContextValue["services"], desktop: AppContextValue["desktop"]) {
  if (action === "open") await desktop.showMain();
  if (action === "capture") await desktop.openWindow({ label: "capture", route: "/captura", title: "Captura rápida", width: 520, height: 420 });
  if (action === "focus") {
    await desktop.showMain();
    await services.focus.start();
    window.dispatchEvent(new CustomEvent("zenstudies-tray", { detail: "focus" }));
  }
  if (action === "review") {
    await desktop.openWindow({ label: "review", route: "/revisoes/sessao", title: "Ciclo Imersivo", width: 1280, height: 800 });
  }
  if (action === "settings") {
    await desktop.showMain();
    window.dispatchEvent(new CustomEvent("zenstudies-tray", { detail: "settings" }));
  }
  if (action === "quit") {
    const result = await flushAllSaves();
    if (result.failed) {
      await desktop.showMain();
      window.alert(`${result.message} O texto foi mantido. Copie o que precisar antes de sair.`);
      return;
    }
    await desktop.quit();
  }
}

function isMainWindow(): boolean {
  const hash = window.location.hash;
  return !hash.includes("/captura") && !hash.includes("/janela/") && !hash.includes("/revisoes/sessao");
}
