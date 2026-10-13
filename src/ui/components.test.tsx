import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./components";

describe("estado vazio", () => {
  it("explica a próxima ação e executa o botão", async () => {
    const onAction = vi.fn();
    render(<EmptyState title="Nada em andamento hoje" body="Crie uma nota para retomar o estudo." action="Criar primeira nota" onAction={onAction} />);
    expect(screen.getByRole("heading", { name: "Nada em andamento hoje" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Criar primeira nota" }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
