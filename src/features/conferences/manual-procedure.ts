export type ManualProcedureInput = {
  examId: string;
  requestedQuantity: string;
  authorizedQuantity: string;
};

export type ManualProcedure = {
  examId: string;
  requestedQuantity: number;
  authorizedQuantity: number;
  isAuthorized: boolean;
};

function parseNonNegativeInteger(value: string) {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function prepareManualProcedure(input: ManualProcedureInput):
  | { status: "valid"; procedure: ManualProcedure }
  | { status: "invalid" } {
  if (!/^[1-9][0-9]*$/.test(input.examId)) return { status: "invalid" };

  const requestedQuantity = parseNonNegativeInteger(input.requestedQuantity);
  const authorizedQuantity = parseNonNegativeInteger(input.authorizedQuantity);
  if (requestedQuantity === null || authorizedQuantity === null) return { status: "invalid" };

  return {
    status: "valid",
    procedure: {
      examId: input.examId,
      requestedQuantity,
      authorizedQuantity,
      isAuthorized: authorizedQuantity > 0,
    },
  };
}
