import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../app/context";
import { FOCUS_PRESETS, clampFocusMinutes, focusEndsAt, focusRemainingMs, formatRemaining } from "../../domain/focus/clock";
import type { FocusSession } from "../../domain/models";
import { loadPreferences } from "../../domain/preferences";
import { useUiStore } from "../../stores/ui-store";
import { MintCore } from "../../ui/Symbol";

const DISMISS_KEY = "zenstudies.focusDismissed";

function useFocusClock() {
  const { services } = useApp();
  const epoch = useUiStore((state) => state.dataEpoch);
  const [open, setOpen] = useState<FocusSession | null>(null);
  const [finished, setFinished] = useState<FocusSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY));
  const [error, setError] = useState<string | null>(null);
  const finishing = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void services.focus.snapshot().then((snapshot) => {
      if (cancelled) return;
      setOpen(snapshot.open);
      setFinished(snapshot.finished);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(services.describeError(reason));
    });
    return () => {
      cancelled = true;
    };
  }, [epoch, services]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open || open.status !== "active") return;
    if (focusRemainingMs(open, new Date(now)) > 0) return;
    if (finishing.current === open.id) return;
    finishing.current = open.id;
    void services.focus.finish(open.id, { notify: true }).catch((reason: unknown) => {
      finishing.current = null;
      setError(services.describeError(reason));
    });
  }, [now, open, services]);

  async function run(work: () => Promise<unknown>) {
    setError(null);
    try {
      await work();
    } catch (reason) {
      setError(services.describeError(reason));
    }
  }

  return {
    open,
    finished: finished && finished.id !== dismissed ? finished : null,
    now,
    error,
    start: (noteId: string | null, minutes: number) => run(() => services.focus.start({ noteId, minutes })),
    pause: (id: string) => run(() => services.focus.pause(id)),
    resume: (id: string) => run(() => services.focus.resume(id)),
    restart: (id: string) => run(() => services.focus.restart(id)),
    finish: (id: string) => run(() => services.focus.finish(id, { notify: false })),
    setPlan: (id: string, minutes: number) => run(() => services.focus.setPlan(id, minutes)),
    dismiss: (id: string) => {
      localStorage.setItem(DISMISS_KEY, id);
      setDismissed(id);
    },
  };
}

function Presets({ minutes, onChange }: { minutes: number; onChange: (minutes: number) => void }) {
  return (
    <div className="focus-presets" role="group" aria-label="Duração da sessão">
      {FOCUS_PRESETS.map((preset) => (
        <button key={preset} type="button" className="button secondary" aria-pressed={minutes === preset} onClick={() => onChange(preset)}>{preset} min</button>
      ))}
      <label className="focus-minutes">
        <span className="sr-only">Duração em minutos</span>
        <input aria-label="Duração em minutos" type="number" min={1} max={180} value={minutes} onChange={(event) => onChange(clampFocusMinutes(Number(event.target.value)))} />
      </label>
    </div>
  );
}

export function FocusPanel({ note }: { note: { id: string; title: string; detail: string } | null }) {
  const navigate = useNavigate();
  const clock = useFocusClock();
  const [minutes, setMinutes] = useState(() => clampFocusMinutes(loadPreferences().focusMinutes));
  const session = clock.open;
  const done = session ? null : clock.finished;
  const shown = session ?? done;
  const remaining = session ? focusRemainingMs(session, new Date(clock.now)) : 0;
  const ends = session ? focusEndsAt(session, new Date(clock.now)) : null;
  const status = session?.status ?? (done ? "completed" : "idle");

  function chooseMinutes(next: number) {
    setMinutes(next);
    if (session && session.status === "paused") void clock.setPlan(session.id, next);
  }

  return (
    <article className="focus-card" data-focus={status}>
      <div>
        <p className="kicker">{status === "active" ? "Foco em andamento" : status === "paused" ? "Foco pausado" : status === "completed" ? "Foco concluído" : "Foco atual"}</p>
        {shown ? (
          <>
            <p className="focus-time" role="timer" aria-label={session ? `${formatRemaining(remaining)} restantes` : "Sessão concluída"}>{session ? formatRemaining(remaining) : formatRemaining(0)}</p>
            <h2>{shown.title}</h2>
            <p>
              {session?.status === "active" && ends ? `Conclui às ${ends.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : null}
              {session?.status === "paused" ? "A contagem está congelada." : null}
              {done ? "O tempo previsto chegou." : null}
            </p>
            {session?.status === "paused" ? <Presets minutes={session.plannedMinutes} onChange={chooseMinutes} /> : null}
            <div className="focus-actions">
              {session?.status === "active" ? <button type="button" className="button" onClick={() => void clock.pause(session.id)}>Pausar</button> : null}
              {session?.status === "paused" ? <button type="button" className="button" onClick={() => void clock.resume(session.id)}>Continuar</button> : null}
              {session ? <button type="button" className="button ghost" onClick={() => void clock.finish(session.id)}>Encerrar</button> : null}
              {shown ? <button type="button" className="button ghost" onClick={() => void clock.restart(shown.id)}>Reiniciar</button> : null}
              {done ? <button type="button" className="button ghost" onClick={() => clock.dismiss(done.id)}>Dispensar</button> : null}
              {shown.noteId ? <button type="button" className="button ghost" onClick={() => navigate(`/notas/${shown.noteId}`)}>Abrir nota</button> : null}
            </div>
          </>
        ) : (
          <>
            <h2>{note?.title ?? "Sessão de foco"}</h2>
            <p>{note ? note.detail : "Escolha a duração e comece quando quiser."}</p>
            <Presets minutes={minutes} onChange={setMinutes} />
            <div className="focus-actions">
              {note ? <button type="button" className="button" onClick={() => navigate(`/notas/${note.id}`)}>Continuar sessão</button> : null}
              <button type="button" className={note ? "button ghost" : "button"} onClick={() => void clock.start(note?.id ?? null, minutes)}>Iniciar foco</button>
            </div>
          </>
        )}
        {clock.error ? <p role="alert">{clock.error}</p> : null}
      </div>
      <MintCore size={28} />
    </article>
  );
}

export function FocusStrip() {
  const navigate = useNavigate();
  const clock = useFocusClock();
  const session = clock.open;
  const done = session ? null : clock.finished;
  const shown = session ?? done;
  if (!shown) return null;
  const remaining = session ? focusRemainingMs(session, new Date(clock.now)) : 0;
  const label = session?.status === "paused" ? "Pausado" : session ? "Em andamento" : "Concluído";
  return (
    <div className="focus-strip" data-focus={session?.status ?? "completed"} role="status">
      <strong>Foco</strong>
      <span className="focus-strip-time">{session ? formatRemaining(remaining) : "00:00"}</span>
      <span>{label} · {shown.title}</span>
      <span className="sidebar-spacer" />
      {session?.status === "active" ? <button type="button" className="button secondary" onClick={() => void clock.pause(session.id)}>Pausar</button> : null}
      {session?.status === "paused" ? <button type="button" className="button secondary" onClick={() => void clock.resume(session.id)}>Continuar</button> : null}
      {done ? <button type="button" className="button secondary" onClick={() => clock.dismiss(done.id)}>Dispensar</button> : null}
      <button type="button" className="button secondary" onClick={() => navigate("/")}>Abrir Hoje</button>
    </div>
  );
}
