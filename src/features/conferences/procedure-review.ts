export type ExtractedProcedure = {
  rawText: string;
  page: number;
  code: string;
  description: string;
  requestedQuantity: number;
  authorizedQuantity: number;
  isAuthorized: boolean;
};

export type CatalogAlias = {
  examId: string;
  normalizedAlias: string;
};

export type CatalogTussCode = { examId: string; code: string };

export type ExplicitComposition = {
  packageExamId: string;
  componentExamId: string;
};

export type ProcedureReviewResolution = "auto_matched" | "needs_review" | "confirmed" | "replaced" | "excluded";

export type ProcedureReview = ExtractedProcedure & {
  sourceIndex: number;
  normalizedText: string;
  resolution: ProcedureReviewResolution;
  matchedExamId: string | null;
  resolvedExamId: string | null;
  expandedExamIds: string[];
};

export function normalizeProcedureText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function expandExplicitComposition(examId: string, compositions: ExplicitComposition[]) {
  const components = compositions
    .filter((composition) => composition.packageExamId === examId)
    .map((composition) => composition.componentExamId);
  return components.length > 0 ? components : [examId];
}

export function isProcedureReviewComplete(reviews: Array<Pick<ProcedureReview, "resolution">>) {
  return reviews.every((review) => review.resolution !== "needs_review");
}

export function resolveExtractedProcedures(
  procedures: ExtractedProcedure[],
  catalog: { aliases: CatalogAlias[]; tussCodes: CatalogTussCode[]; compositions: ExplicitComposition[] },
): ProcedureReview[] {
  return procedures.map((procedure, sourceIndex) => {
    const normalizedText = normalizeProcedureText(procedure.description);
    const matchingCodes = catalog.tussCodes.filter((entry) => entry.code === procedure.code);
    const matchingAliases = catalog.aliases.filter((alias) => alias.normalizedAlias === normalizedText);
    const matchedExamId = matchingCodes.length === 1 ? matchingCodes[0].examId : matchingAliases.length === 1 ? matchingAliases[0].examId : null;

    return {
      ...procedure,
      sourceIndex,
      normalizedText,
      resolution: matchedExamId ? "auto_matched" : "needs_review",
      matchedExamId,
      resolvedExamId: matchedExamId,
      expandedExamIds: matchedExamId ? expandExplicitComposition(matchedExamId, catalog.compositions) : [],
    };
  });
}
