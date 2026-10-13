import type { StudyServices } from "../application/services";

let current: StudyServices | null = null;

export function bindServices(services: StudyServices): void {
  current = services;
}

export function boundServices(): StudyServices {
  if (!current) throw new Error("Os serviços do ZenStudies ainda não estão disponíveis.");
  return current;
}
