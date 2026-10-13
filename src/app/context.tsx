import { createContext, useContext } from "react";
import type { StudyServices } from "../application/services";
import type { DesktopGateway } from "../desktop/gateway";
import type { SyncBus } from "../desktop/sync-bus";

export interface AppContextValue {
  services: StudyServices;
  desktop: DesktopGateway;
  sync: SyncBus;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ value, children }: { value: AppContextValue; children: React.ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("O aplicativo ainda não está pronto.");
  return value;
}

export function useServices(): StudyServices {
  return useApp().services;
}
