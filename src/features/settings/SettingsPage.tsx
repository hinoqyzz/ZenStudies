import { useEffect, useState } from "react";
import { useApp } from "../../app/context";
import product from "../../../product.json";
import { findShortcutConflicts, SHORTCUTS } from "../../domain/shortcuts";
import { loadPreferences, resolveMotion, savePreferences, type Preferences } from "../../domain/preferences";
import { SCHEMA_VERSION } from "../../domain/models";
import { ConfirmDialog } from "../../ui/components";
import { useUiStore } from "../../stores/ui-store";

export function SettingsPage() {
  const { services, desktop } = useApp();
  const setReplay = useUiStore((state) => state.setReplayPreloader);
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences());
  const [trashCount, setTrashCount] = useState(0);
  const [orphans, setOrphans] = useState<{ id: string; originalName: string }[]>([]);
  const [hasDemo, setHasDemo] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState<string | null>(null);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [importPath, setImportPath] = useState<string | null>(null);
  const conflicts = findShortcutConflicts(SHORTCUTS.filter((item) => item.scope === "global"));

  useEffect(() => {
    void Promise.all([services.trash.list(), services.attachments.orphans(), services.demo.has()]).then(([trash, files, demo]) => {
      setTrashCount(trash.length);
      setOrphans(files);
      setHasDemo(demo);
    });
  }, [services]);

  function update(patch: Partial<Preferences>) {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    savePreferences(next);
    document.documentElement.dataset.theme = next.theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : next.theme;
    document.documentElement.dataset.motion = resolveMotion(next.motion, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    document.documentElement.style.setProperty("--editor-size", `${next.editorFontSize}px`);
    document.documentElement.style.setProperty("--reading-width", `${next.readingWidth}px`);
    if ("closeToTray" in patch) void desktop.setCloseToTray(next.closeToTray);
    if ("startWithWindows" in patch) void desktop.setAutostart(next.startWithWindows);
    if (patch.notificationsEnabled) void desktop.requestNotificationPermission();
    if ("notificationsEnabled" in patch && next.notificationsEnabled) {
      void desktop.requestNotificationPermission();
    }
  }

  return (
    <div className="settings">
      <h2 className="display">Configurações</h2>
      <section>
        <h3>Aparência</h3>
        <label className="field"><span>Tema</span>
          <select value={preferences.theme} onChange={(event) => update({ theme: event.target.value as Preferences["theme"] })}>
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
            <option value="system">Seguir o sistema</option>
          </select>
        </label>
        <label className="field"><span>Texto do editor ({preferences.editorFontSize}px)</span>
          <input type="range" min={15} max={20} value={preferences.editorFontSize} onChange={(event) => update({ editorFontSize: Number(event.target.value) })} />
        </label>
        <label className="field"><span>Largura de leitura ({preferences.readingWidth}px)</span>
          <input type="range" min={640} max={760} step={8} value={preferences.readingWidth} onChange={(event) => update({ readingWidth: Number(event.target.value) })} />
        </label>
        <label className="field"><span>Animações</span>
          <select value={preferences.motion} onChange={(event) => update({ motion: event.target.value as Preferences["motion"] })}>
            <option value="full">Completas</option>
            <option value="reduced">Reduzidas</option>
            <option value="off">Desativadas</option>
          </select>
        </label>
        <button type="button" className="button secondary" onClick={() => { savePreferences({ ...loadPreferences(), preloaderSeen: false }); setReplay(true); }}>Ver animação de abertura</button>
      </section>
      <section>
        <h3>Foco e revisão</h3>
        <label className="field"><span>Duração padrão do foco ({preferences.focusMinutes} min)</span>
          <input type="number" min={5} max={180} value={preferences.focusMinutes} onChange={(event) => update({ focusMinutes: Number(event.target.value) })} />
        </label>
        <label className="field"><span><input type="checkbox" checked={preferences.reviewEnabled} onChange={(event) => update({ reviewEnabled: event.target.checked })} /> Avisar revisões vencidas</span></label>
        <label className="field"><span>Horário</span>
          <input type="time" value={`${String(preferences.reviewHour).padStart(2, "0")}:${String(preferences.reviewMinute).padStart(2, "0")}`} onChange={(event) => {
            const [hour, minute] = event.target.value.split(":");
            update({ reviewHour: Number(hour), reviewMinute: Number(minute) });
          }} />
        </label>
      </section>
      <section>
        <h3>Notificações e bandeja</h3>
        <p className="muted">As notificações desta versão só saem enquanto o ZenStudies está aberto ou na bandeja. Elas usam o sistema do Windows, não um aviso interno.</p>
        <label className="field"><span><input type="checkbox" checked={preferences.notificationsEnabled} onChange={(event) => update({ notificationsEnabled: event.target.checked })} /> Permitir notificações</span></label>
        <label className="field"><span><input type="checkbox" checked={preferences.notifyFocusEnd} onChange={(event) => update({ notifyFocusEnd: event.target.checked })} /> Fim da sessão de foco</span></label>
        <label className="field"><span><input type="checkbox" checked={preferences.notifyReviews} onChange={(event) => update({ notifyReviews: event.target.checked })} /> Revisões no horário escolhido</span></label>
        <label className="field"><span><input type="checkbox" checked={preferences.notifySaveFailure} onChange={(event) => update({ notifySaveFailure: event.target.checked })} /> Falha crítica de salvamento na bandeja</span></label>
        <label className="field"><span><input type="checkbox" checked={preferences.closeToTray} onChange={(event) => update({ closeToTray: event.target.checked })} /> Continuar em segundo plano ao fechar</span></label>
        <label className="field"><span><input type="checkbox" checked={preferences.startWithWindows} onChange={(event) => update({ startWithWindows: event.target.checked })} /> Iniciar com o Windows</span></label>
      </section>
      <section>
        <h3>Atalhos</h3>
        <ul>
          {SHORTCUTS.map((shortcut) => <li key={shortcut.id}>{shortcut.label} · {shortcut.keys} · {shortcut.scope}</li>)}
        </ul>
        <p>{conflicts.length === 0 ? "Nenhum conflito no mesmo escopo." : conflicts.map(([left, right]) => `${left.label} e ${right.label} usam ${left.keys}.`).join(" ")}</p>
      </section>
      <section>
        <h3>Backup</h3>
        <div className="focus-actions">
          <button type="button" className="button" onClick={() => void services.backup.export().then((path) => setMessage(path ? `Backup salvo em ${path}` : "Exportação cancelada.")).catch((error: unknown) => setMessage(services.describeError(error)))}>Exportar backup</button>
          <button type="button" className="button secondary" onClick={() => void services.backup.inspect().then((preview) => {
            if (!preview) return;
            setImportPath(preview.path);
          }).catch((error: unknown) => setMessage(services.describeError(error)))}>Importar backup</button>
        </div>
        {message ? <p>{message}</p> : null}
      </section>
      <section>
        <h3>Dados</h3>
        <button type="button" className="button secondary" disabled={!hasDemo} onClick={() => setConfirmDemo(true)}>Limpar dados demonstrativos</button>
        <button type="button" className="button danger" disabled={trashCount === 0} onClick={() => setConfirmEmpty(true)}>Esvaziar lixeira ({trashCount})</button>
        <h3>Arquivos sem referência</h3>
        <p className="muted">Um anexo só é apagado do disco depois desta confirmação, e apenas se nenhuma nota o citar.</p>
        {orphans.map((file) => <div key={file.id}>{file.originalName}</div>)}
        <button type="button" className="button secondary" disabled={orphans.length === 0} onClick={() => void services.attachments.purgeOrphans(orphans.map((file) => file.id)).then(() => setOrphans([]))}>Limpar arquivos sem referência</button>
      </section>
      <section>
        <h3>Sobre</h3>
        <p>ZenStudies {product.version}</p>
        <p>Schema {SCHEMA_VERSION}</p>
        <p className="muted">Aplicativo local. Não há conta, nuvem nem assinatura digital neste instalador.</p>
      </section>
      {importPath ? (
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
          <h2 id="import-title">Como importar este backup?</h2>
          <p>Mesclar adiciona só o que ainda não existe. Substituir pede confirmação e cria antes um backup de segurança.</p>
          <div className="focus-actions">
            <button type="button" className="button secondary" onClick={() => setImportPath(null)}>Cancelar</button>
            <button type="button" className="button secondary" onClick={() => { setConfirmReplace(importPath); setImportPath(null); }}>Substituir</button>
            <button type="button" className="button" onClick={() => {
              const path = importPath;
              setImportPath(null);
              void services.backup.merge(path).then((result) => setMessage(`Mesclado: ${result.added} novos, ${result.kept} mantidos.`)).catch((error: unknown) => setMessage(services.describeError(error)));
            }}>Mesclar</button>
          </div>
        </div>
      ) : null}
      <ConfirmDialog open={confirmEmpty} title="Esvaziar a lixeira?" body="A exclusão permanente não pode ser desfeita." confirmLabel="Esvaziar" danger onCancel={() => setConfirmEmpty(false)} onConfirm={() => void services.trash.empty().then(() => { setTrashCount(0); setConfirmEmpty(false); })} />
      <ConfirmDialog open={Boolean(confirmReplace)} title="Substituir os dados atuais?" body="Um backup de segurança será criado antes. Se a importação falhar, os dados atuais permanecem na transação e o backup de segurança fica disponível." confirmLabel="Substituir" danger onCancel={() => setConfirmReplace(null)} onConfirm={() => {
        if (!confirmReplace) return;
        void services.backup.replace(confirmReplace).then((result) => setMessage(`Dados substituídos. Backup de segurança: ${result.safetyPath}`)).catch((error: unknown) => setMessage(services.describeError(error))).finally(() => setConfirmReplace(null));
      }} />
      <ConfirmDialog open={confirmDemo} title="Apagar o conteúdo demonstrativo?" body="Notas, matérias e cartões de exemplo serão removidos, mesmo se você os editou. O que você criou permanece." confirmLabel="Apagar exemplos" danger onCancel={() => setConfirmDemo(false)} onConfirm={() => void services.demo.clear().then(() => { setHasDemo(false); setConfirmDemo(false); })} />
    </div>
  );
}
