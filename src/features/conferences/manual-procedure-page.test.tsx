import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ManualProcedureTranscriptionView } from "./manual-procedure-page";

describe("transcrição manual", () => {
  it("oferece catálogo e quantidades quando a leitura não está disponível", () => {
    render(<ManualProcedureTranscriptionView conferenceId="conference-1" exams={[{ id: "42", name: "HEMOGRAMA", mnemonic: "HEMO" }]} saveAction={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Transcrição manual dos procedimentos" })).toBeVisible();
    expect(screen.getByLabelText("Exame do catálogo")).toHaveAttribute("list", "manual-exams");
    expect(document.querySelector("datalist option")).toHaveAttribute("label", "HEMOGRAMA (HEMO)");
    expect(document.querySelector("datalist option")).toHaveValue("42");
    expect(screen.getByLabelText("Quantidade solicitada")).toHaveAttribute("min", "0");
    expect(screen.getByLabelText("Texto registrado manualmente")).toBeRequired();
  });
});
