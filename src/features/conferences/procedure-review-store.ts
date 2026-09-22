import {
  resolveExtractedProcedures,
  type CatalogAlias,
  type ExplicitComposition,
  type ExtractedProcedure,
  type ProcedureReview,
} from "./procedure-review";

export type ProcedureReviewStoreGateway = {
  countReviews(conferenceId: string): Promise<{ count: number; error: string | null }>;
  listAliases(): Promise<{ aliases: CatalogAlias[]; error: string | null }>;
  listTussCodes(): Promise<{ tussCodes: Array<{ examId: string; code: string }>; error: string | null }>;
  listCompositions(): Promise<{ compositions: ExplicitComposition[]; error: string | null }>;
  saveInitialReviews(conferenceId: string, reviews: ProcedureReview[]): Promise<{ error: string | null }>;
};

export type ProcedureReviewStoreResult =
  | { status: "success" }
  | { status: "error"; message: string };

export async function persistInitialProcedureReviews(
  conferenceId: string,
  procedures: ExtractedProcedure[],
  gateway: ProcedureReviewStoreGateway,
): Promise<ProcedureReviewStoreResult> {
  const existing = await gateway.countReviews(conferenceId);
  if (existing.error) return { status: "error", message: "Não foi possível consultar as revisões da conferência." };
  if (existing.count > 0 || procedures.length === 0) return { status: "success" };

  const [aliasesResult, tussCodesResult, compositionsResult] = await Promise.all([
    gateway.listAliases(),
    gateway.listTussCodes(),
    gateway.listCompositions(),
  ]);
  if (aliasesResult.error || tussCodesResult.error || compositionsResult.error) {
    return { status: "error", message: "Não foi possível consultar o catálogo vigente." };
  }

  const reviews = resolveExtractedProcedures(procedures, {
    aliases: aliasesResult.aliases,
    tussCodes: tussCodesResult.tussCodes,
    compositions: compositionsResult.compositions,
  });
  const saved = await gateway.saveInitialReviews(conferenceId, reviews);
  return saved.error
    ? { status: "error", message: "Não foi possível salvar as revisões da conferência." }
    : { status: "success" };
}
