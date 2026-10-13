import type { StudyServices } from "../../application/services";
import type { DesktopGateway } from "../../desktop/gateway";

export async function importPdf(services: StudyServices, desktop: DesktopGateway) {
  if (desktop.kind === "tauri") {
    const path = await desktop.pickOpen([{ name: "PDF", extensions: ["pdf"] }]);
    if (!path) return null;
    return services.pdfs.importPath(path);
  }
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/pdf,.pdf";
  const file = await new Promise<File | null>((resolve) => {
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
  if (!file) return null;
  return services.pdfs.importBytes(file.name, new Uint8Array(await file.arrayBuffer()));
}
