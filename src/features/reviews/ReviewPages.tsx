import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../app/context";
import type { Card, ReviewEvent, ReviewSession } from "../../domain/models";
import { resolveMotion, loadPreferences } from "../../domain/preferences";
import { useUiStore } from "../../stores/ui-store";
import { EmptyState } from "../../ui/components";
import { SymbolMark } from "../../ui/Symbol";

gsap.registerPlugin(useGSAP);

export function ReviewsPage() {
  const { services } = useApp();
  const navigate = useNavigate();
  const [due, setDue] = useState<Card[]>([]);
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [active, setActive] = useState<ReviewSession | null>(null);
  const dataEpoch = useUiStore((state) => state.dataEpoch);

  useEffect(() => {
    void Promise.all([services.cards.due(), services.review.events(), services.review.active()]).then(([nextDue, nextEvents, nextActive]) => {
      setDue(nextDue);
      setEvents(nextEvents.slice(0, 8));
      setActive(nextActive);
    });
  }, [dataEpoch, services]);

  return (
    <div className="today-main">
      <h2 className="display">Revisões</h2>
      {due.length === 0 && !active ? (
        <EmptyState title="Nenhum cartão para hoje" body="Quando uma nota virar cartão, ele aparece aqui no dia em que vence. Nada é cobrado fora da fila." action="Ver notas" onAction={() => navigate("/notas")} />
      ) : (
        <>
          <p className="muted">{active ? "Há uma sessão incompleta." : due.length === 1 ? "1 cartão entra na fila de hoje." : `${due.length} cartões entram na fila de hoje.`}</p>
          <button type="button" className="button" onClick={() => navigate("/revisoes/sessao")}>{active ? "Retomar sessão" : "Iniciar revisão"}</button>
        </>
      )}
      {events.length > 0 ? (
        <>
          <h3>Histórico recente</h3>
          <ul>
            {events.map((event) => (
              <li key={event.id}>{label(event.response)} · {new Date(event.reviewedAt).toLocaleString("pt-BR")}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export function ImmersiveReview() {
  const { services, desktop } = useApp();
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState("");
  const dataEpoch = useUiStore((state) => state.dataEpoch);
  const reduced = resolveMotion(loadPreferences().motion, window.matchMedia("(prefers-reduced-motion: reduce)").matches) !== "full";
  const leaving = useRef(false);

  useGSAP(() => {
    if (!root.current || reduced) return;
    gsap.from(root.current.querySelector("[data-review-card]"), { y: 12, opacity: 0, duration: 0.42, ease: "power2.out" });
  }, { scope: root, dependencies: [card?.id, reduced] });

  async function load() {
    const next = await services.review.startOrResume();
    setSession(next);
    if (!next) {
      setMessage("Não há cartões ativos vencidos hoje.");
      setCard(null);
      return;
    }
    const currentId = next.cardIds[next.position];
    const cards = await services.cards.list();
    setCard(cards.find((item) => item.id === currentId) ?? null);
    setRevealed(false);
  }

  useEffect(() => {
    void load();
  }, [dataEpoch, services]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        leave();
      } else if (event.code === "Space") {
        event.preventDefault();
        setRevealed(true);
      } else if (revealed && (event.key === "1" || event.key === "2" || event.key === "3")) {
        event.preventDefault();
        void grade(event.key === "1" ? "again" : event.key === "2" ? "hard" : "good");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function leave() {
    if (leaving.current) return;
    leaving.current = true;
    const go = () => {
      void desktop.currentLabel().then(async (label) => {
        if (label === "review") {
          await desktop.closeCurrent();
          return;
        }
        navigate("/revisoes");
      });
    };
    if (reduced || !root.current) {
      go();
      return;
    }
    gsap.to(root.current, { opacity: 0, y: 8, duration: 0.24, ease: "power2.in", onComplete: go });
  }

  async function grade(response: "again" | "hard" | "good") {
    if (!session || !card) return;
    const result = await services.review.answer(session.id, response);
    setSession(result.session);
    if (result.session.status === "completed") {
      setCard(null);
      setMessage("Sessão concluída. O histórico foi guardado.");
      return;
    }
    const cards = await services.cards.list();
    const nextId = result.session.cardIds[result.session.position];
    setCard(cards.find((item) => item.id === nextId) ?? null);
    setRevealed(false);
  }

  const index = session ? Math.min(session.position + 1, session.cardIds.length) : 0;
  const total = session?.cardIds.length ?? 0;

  return (
    <div className="immersive" ref={root}>
      <div className="immersive-top">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <SymbolMark size={34} title="ZenStudies" />
          <strong>Ciclo Imersivo</strong>
        </div>
        <button type="button" className="button ghost" style={{ color: "#91a29c" }} onClick={leave}>Esc para sair</button>
      </div>
      <div className="immersive-grid">
        <aside>
          <p className="kicker">Sessão</p>
          <h2>{card?.subjectName ?? "Revisão"}</h2>
          <p>{total ? `${index} de ${total} ${total === 1 ? "cartão" : "cartões"}` : "Sem fila"}</p>
          <div className="progress" aria-hidden="true"><span style={{ width: total ? `${(session?.position ?? 0) / total * 100}%` : "0%" }} /></div>
          <p className="kicker">Ritmo</p>
          <p>Sem cronômetro</p>
          <p>Sem sequência punitiva</p>
          <p>Pausar quando quiser</p>
        </aside>
        <article className="review-card" data-review-card>
          {card ? (
            <>
              <p className="kicker">Pergunta {index}</p>
              <h2>{card.question}</h2>
              {revealed ? <p className="answer">{card.answer}</p> : <p className="muted">Pense na resposta antes de revelá-la.</p>}
              {!revealed ? <button type="button" className="button" onClick={() => setRevealed(true)}>Mostrar resposta</button> : (
                <div className="rate">
                  <button type="button" onClick={() => void grade("again")}>Ainda não · 1</button>
                  <button type="button" onClick={() => void grade("hard")}>Quase · 2</button>
                  <button type="button" onClick={() => void grade("good")}>Lembrei · 3</button>
                </div>
              )}
            </>
          ) : (
            <div>
              <h2>{message || "Carregando a fila"}</h2>
              <button type="button" className="button" onClick={leave}>Voltar</button>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

function label(response: ReviewEvent["response"]) {
  if (response === "again") return "Ainda não";
  if (response === "hard") return "Quase";
  return "Lembrei";
}
