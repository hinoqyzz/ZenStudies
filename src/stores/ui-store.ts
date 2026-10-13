import { create } from "zustand";
import type { Note } from "../domain/models";

export interface ToastItem {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface UiState {
  commandOpen: boolean;
  toasts: ToastItem[];
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveDetail: string;
  unsavedText: string;
  conflict: Note | null;
  peekNoteId: string | null;
  sidebarCollapsed: boolean;
  inspectorCollapsed: boolean;
  replayPreloader: boolean;
  dataEpoch: number;
  setCommandOpen: (open: boolean) => void;
  pushToast: (toast: Omit<ToastItem, "id">) => string;
  dismissToast: (id: string) => void;
  setSaveStatus: (status: UiState["saveStatus"], detail?: string) => void;
  setUnsavedText: (text: string) => void;
  setConflict: (note: Note | null) => void;
  setPeekNoteId: (id: string | null) => void;
  setSidebarCollapsed: (value: boolean) => void;
  setInspectorCollapsed: (value: boolean) => void;
  setReplayPreloader: (value: boolean) => void;
  bumpData: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  commandOpen: false,
  toasts: [],
  saveStatus: "idle",
  saveDetail: "",
  unsavedText: "",
  conflict: null,
  peekNoteId: null,
  sidebarCollapsed: false,
  inspectorCollapsed: false,
  replayPreloader: false,
  dataEpoch: 0,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  pushToast: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
    }, 8000);
    return id;
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
  setSaveStatus: (saveStatus, saveDetail = "") => set({ saveStatus, saveDetail }),
  setUnsavedText: (unsavedText) => set({ unsavedText }),
  setConflict: (conflict) => set({ conflict }),
  setPeekNoteId: (peekNoteId) => set({ peekNoteId }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setInspectorCollapsed: (inspectorCollapsed) => set({ inspectorCollapsed }),
  setReplayPreloader: (replayPreloader) => set({ replayPreloader }),
  bumpData: () => set((state) => ({ dataEpoch: state.dataEpoch + 1 })),
}));
