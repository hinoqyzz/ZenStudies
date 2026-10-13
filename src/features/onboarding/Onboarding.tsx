import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../app/context";
import keyArt from "../../assets/brand/zenstudies-key-art.png";
import { SymbolMark } from "../../ui/Symbol";

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { services } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [subjectName, setSubjectName] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [demo, setDemo] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [shift, setShift] = useState({ x: 0, y: 0 });

  async function finish() {
    if (demo) await services.demo.seed();
    if (question.trim() && answer.trim() && noteId) await services.cards.create({ noteId, question, answer });
    await services.completeOnboarding();
    onDone();
    if (noteId) navigate(`/notas/${noteId}`);
  }

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-mask" />
        <Dialog.Content
          className="dialog"
          aria-describedby="onboarding-body"
          onPointerMove={(event) => {
            if (step !== 0 || document.documentElement.dataset.motion !== "full") return;
            const bounds = event.currentTarget.getBoundingClientRect();
            const x = Math.max(-4, Math.min(4, ((event.clientX - bounds.left) / bounds.width - 0.5) * 8));
            const y = Math.max(-4, Math.min(4, ((event.clientY - bounds.top) / bounds.height - 0.5) * 8));
            setShift({ x, y });
          }}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
        <div className="steps" aria-hidden="true"><i className={step >= 0 ? "on" : ""} /><i className={step >= 1 ? "on" : ""} /><i className={step >= 2 ? "on" : ""} /></div>
        {step === 0 ? (
          <>
            <img className="key-art" src={keyArt} alt="" style={{ transform: `translate(${shift.x}px, ${shift.y}px)` }} />
            <SymbolMark size={72} light="#101C1A" coreStroke="#F5F6F0" title="ZenStudies" />
            <Dialog.Title asChild><h2 id="onboarding-title">Um ciclo calmo para estudar</h2></Dialog.Title>
            <Dialog.Description id="onboarding-body">O ZenStudies guarda notas, PDFs e revisões neste computador. Não há conta nem nuvem. Você pode pular e começar vazio.</Dialog.Description>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <Dialog.Title asChild><h2 id="onboarding-title">Primeira matéria e nota</h2></Dialog.Title>
            <Dialog.Description id="onboarding-body">Dê um nome à matéria e à nota. Você pode deixar em branco e criar depois.</Dialog.Description>
            <label className="field"><span>Matéria</span><input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} /></label>
            <label className="field"><span>Nota</span><input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} /></label>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <Dialog.Title asChild><h2 id="onboarding-title">Primeiro cartão</h2></Dialog.Title>
            <Dialog.Description id="onboarding-body">O cartão entra na fila do dia. Os exemplos são opcionais e podem ser apagados sem levar o que você escreveu.</Dialog.Description>
            <label className="field"><span>Pergunta</span><input value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
            <label className="field"><span>Resposta</span><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} /></label>
            <label className="field"><span><input type="checkbox" checked={demo} onChange={(event) => setDemo(event.target.checked)} /> Adicionar exemplos de Biologia celular, História moderna e Matemática</span></label>
            <p className="muted">Os exemplos podem ser apagados depois sem levar o que você escreveu.</p>
          </>
        ) : null}
        <div className="focus-actions">
          <button type="button" className="button secondary" onClick={() => void services.completeOnboarding().then(onDone)}>Pular</button>
          {step < 2 ? (
            <button type="button" className="button" onClick={() => void (async () => {
              if (step === 1 && subjectName.trim()) {
                const subject = await services.subjects.create(subjectName);
                const note = await services.notes.create({ title: noteTitle || subjectName, subjectId: subject.id, text: "" });
                setNoteId(note.id);
              }
              setStep((value) => value + 1);
            })()}>Continuar</button>
          ) : (
            <button type="button" className="button" onClick={() => void finish()}>Começar</button>
          )}
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
