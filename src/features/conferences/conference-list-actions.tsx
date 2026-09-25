"use client";

import Link from "next/link";
import type { FormEvent } from "react";

type ConferenceAction = (formData: FormData) => Promise<void>;

export function ConferenceListActions({
  conferenceId,
  finalized,
  deleteAction,
  revisionAction,
}: {
  conferenceId: string;
  finalized: boolean;
  deleteAction: ConferenceAction;
  revisionAction: ConferenceAction;
}) {
  function confirmDeletion(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Excluir esta conferência? Os PDFs e os dados identificáveis serão removidos. Esta ação não pode ser desfeita.")) {
      event.preventDefault();
    }
  }

  return (
    <div className="conference-row-actions">
      {finalized ? (
        <form action={revisionAction}>
          <input type="hidden" name="conferenceId" value={conferenceId} />
          <button className="button-secondary" type="submit">Editar em nova revisão</button>
        </form>
      ) : (
        <Link className="action-link action-link--secondary action-link--open" href={`/conferencias/${conferenceId}`}>Editar conferência</Link>
      )}
      <form action={deleteAction} onSubmit={confirmDeletion}>
        <input type="hidden" name="conferenceId" value={conferenceId} />
        <button className="button-danger" type="submit">Excluir</button>
      </form>
    </div>
  );
}
