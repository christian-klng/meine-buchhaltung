// Normalisiertes Ziel aller Bank-Parser (Adapter-Layer, Plan Abschnitt 8).
export interface ParsedTx {
  date: Date;
  amountCents: number; // vorzeichenbehaftet: negativ = Abbuchung (DBIT)
  currency: string;
  counterparty: string | null;
  purpose: string | null;
  rawRef: string | null;
}

export interface ParsedStatement {
  format: string; // camt052 | camt053 | csv
  account: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  transactions: ParsedTx[];
}
