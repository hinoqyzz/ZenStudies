import { useEffect, useState } from "react";
import { useApp } from "../../app/context";
import type { TrashItem } from "../../domain/models";
import { useUiStore } from "../../stores/ui-store";
import { ConfirmDialog, EmptyState } from "../../ui/components";

export function TrashPage() {
  const { services } = useApp();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [pending, setPending] = useState<TrashItem | null>(null);
  const dataEpoch = useUiStore((state) => state.dataEpoch);

  async function reload() {
    setItems(await services.trash.list());
  }
  useEffect(() => { void reload(); }, [dataEpoch, services]);

  return (
    <div className="today-main">
      <h2 className="display">Lixeira</h2>
      {items.length === 0 ? <EmptyState title="A lixeira está vazia" body="Notas excluídas ficam aqui até você restaurar ou apagar de forma permanente." action="Voltar às notas" onAction={() => { window.location.hash = "#/notas"; }} /> : null}
      <div className="stack">
        {items.map((item) => (
          <div key={item.id} className="list-card">
            <div>
              <strong>{item.title}</strong>
              <div className="meta">{item.entityType} · {new Date(item.deletedAt).toLocaleString("pt-BR")}</div>
            </div>
            <button type="button" className="button secondary" onClick={() => void services.trash.restore(item.id).then(reload)}>Restaurar</button>
            <button type="button" className="button danger" onClick={() => setPending(item)}>Apagar</button>
          </div>
        ))}
      </div>
      <ConfirmDialog open={Boolean(pending)} title="Apagar permanentemente?" body="Conteúdo, conexões e cartões ligados a este item saem da lixeira e não podem ser desfeitos." confirmLabel="Apagar" danger onCancel={() => setPending(null)} onConfirm={() => pending ? void services.trash.purge(pending.id).then(() => { setPending(null); void reload(); }) : undefined} />
    </div>
  );
}
