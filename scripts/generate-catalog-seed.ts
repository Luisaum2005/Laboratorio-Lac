import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { readCanonicalExams } from "../src/features/catalog/spreadsheet-catalog.ts";

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const sourcePath = resolve("docs/EXAMES UNIMED.xls");
const outputPath = resolve("supabase/seed.sql");
const exams = readCanonicalExams(await readFile(sourcePath, "utf8"));

if (exams.length !== 687) {
  throw new Error(`Expected 687 canonical exams, received ${exams.length}.`);
}

const values = exams
  .map((exam) => `  (${sqlLiteral(exam.name)}, ${sqlLiteral(exam.mnemonic)})`)
  .join(",\n");

const sql = `insert into public.exams (name, mnemonic)\nvalues\n${values}\non conflict (mnemonic) do update\nset name = excluded.name, updated_at = now();\n`;

await writeFile(outputPath, sql, "utf8");
console.log(`Generated ${exams.length} canonical exams in ${outputPath}.`);
