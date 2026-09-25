"use client";

import { useState } from "react";

import type { SelectableExam } from "./manual-procedure-page";

type MedicalRequestFormProps = {
  conferenceId: string;
  doctorName: string | null;
  exams: SelectableExam[];
  saveAction: (formData: FormData) => Promise<void>;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function MedicalRequestForm({ conferenceId, doctorName, exams, saveAction }: MedicalRequestFormProps) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const normalizedQuery = normalize(query);
  const matches = normalizedQuery
    ? exams.filter((exam) => normalize(`${exam.name} ${exam.mnemonic}`).includes(normalizedQuery))
    : exams;
  const visibleMatches = normalizedQuery ? matches.slice(0, 30) : matches;
  const selectedExams = selectedIds.flatMap((id) => {
    const exam = exams.find((candidate) => candidate.id === id);
    return exam ? [exam] : [];
  });

  function toggleExam(examId: string, checked: boolean) {
    setSelectedIds((current) => checked
      ? current.includes(examId) ? current : [...current, examId]
      : current.filter((id) => id !== examId));
  }

  function removeExam(examId: string) {
    setSelectedIds((current) => current.filter((id) => id !== examId));
  }

  return <form action={saveAction} className="medical-request-form">
    <input type="hidden" name="conferenceId" value={conferenceId} />
    <div className="medical-request-fields">
      <div className="form-field">
        <label htmlFor="doctor-name">Médico solicitante</label>
        <input id="doctor-name" name="doctorName" defaultValue={doctorName ?? ""} placeholder="Nome do médico (opcional)" />
      </div>
      <div className="form-field">
        <label htmlFor="request-raw-text">Texto do pedido médico</label>
        <textarea id="request-raw-text" name="rawText" rows={3} placeholder="Observação ou texto do pedido (opcional)" />
        <span className="field-hint">Se não houver pedido médico, deixe em branco e continue.</span>
      </div>
      <div className="form-field exam-picker-field">
        <label htmlFor="request-exams-search">Exames do pedido médico</label>
        <p id="request-exams-help" className="field-hint">A lista já está disponível abaixo. Pesquise pelo nome ou mnemônico para filtrar e marque os exames desejados.</p>
        <input
          autoComplete="off"
          id="request-exams-search"
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Ex.: hemograma ou HEMO"
          type="search"
          value={query}
          aria-describedby="request-exams-help"
        />
        <div className="exam-picker-results">
          {visibleMatches.length ? <>
              <p className="exam-results-count" role="status">{normalizedQuery
                ? `${matches.length} ${matches.length === 1 ? "exame encontrado" : "exames encontrados"}${matches.length > 30 ? " · refine a busca para ver resultados mais específicos" : ""}`
                : `${matches.length} exames no catálogo · use a busca para filtrar`}</p>
              <ul className="exam-results-list" aria-label="Resultados dos exames">
                {visibleMatches.map((exam) => {
                  const checked = selectedIds.includes(exam.id);
                  return <li key={exam.id}>
                    <label className={`exam-option${checked ? " is-selected" : ""}`}>
                      <input
                        checked={checked}
                        name="examIds"
                        onChange={(event) => toggleExam(exam.id, event.currentTarget.checked)}
                        type="checkbox"
                        value={exam.id}
                      />
                      <span className="exam-option-name">{exam.name}</span>
                      <code>{exam.mnemonic}</code>
                    </label>
                  </li>;
                })}
              </ul>
            </> : <p className="exam-picker-empty">Nenhum exame encontrado. Confira a escrita ou tente buscar pelo mnemônico.</p>}
        </div>
      </div>
    </div>
    <section className="selected-exams" aria-labelledby="selected-exams-heading">
      <div className="selected-exams-heading">
        <h3 id="selected-exams-heading">Exames selecionados</h3>
        <span className="selected-exams-count">{selectedExams.length}</span>
      </div>
      {selectedExams.length ? <ul className="selected-exams-list">
        {selectedExams.map((exam) => <li className="selected-exam-chip" key={exam.id}>
          <span>{exam.name} <code>{exam.mnemonic}</code></span>
          <button aria-label={`Remover ${exam.name} da seleção`} className="selected-exam-remove" onClick={() => removeExam(exam.id)} type="button">×</button>
        </li>)}
      </ul> : <p className="exam-picker-empty">Nenhum exame selecionado. Esta etapa é opcional; você pode continuar sem pedido médico.</p>}
    </section>
    {selectedExams.length > 0 ? <div className="form-actions">
      <button type="submit">Adicionar {selectedExams.length} {selectedExams.length === 1 ? "exame" : "exames"} ao pedido</button>
    </div> : null}
  </form>;
}
