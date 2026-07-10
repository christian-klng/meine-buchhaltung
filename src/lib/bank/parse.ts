// Adapter-Dispatcher: erkennt das Format am Inhalt und wählt den passenden Parser.
import { parseCamt } from "./camt";
import { parseCsv } from "./csv";
import type { ParsedStatement } from "./types";

export function parseBankFile(content: string): ParsedStatement {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("<")) return parseCamt(content);
  return parseCsv(content);
}

export type { ParsedStatement, ParsedTx } from "./types";
