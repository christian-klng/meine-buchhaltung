"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { confirmMatch, markPrivate } from "./actions";
import { Badge } from "@/components/ui";
import { formatEur, formatDate } from "@/lib/format";

export interface MatchView {
  voucherId: string;
  transactionId: string;
  confidence: number;
  reason: string;
  voucherLabel: string;
  voucherAmountCents: number;
  voucherDateISO: string;
  fx: boolean;
  txLabel: string;
  txAmountCents: number;
  txDateISO: string;
}
export interface TxView {
  id: string;
  label: string;
  amountCents: number;
  dateISO: string;
  purpose: string | null;
}
export interface VoucherView {
  id: string;
  label: string;
  amountCents: number;
  dateISO: string;
  status: string;
}
export interface DupView {
  key: string;
  vouchers: { id: string; label: string }[];
}

export function AbgleichClient({
  matches,
  missingTx,
  missingVoucher,
  duplicates,
}: {
  matches: MatchView[];
  missingTx: TxView[];
  missingVoucher: VoucherView[];
  duplicates: DupView[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  return (
    <div className="space-y-8">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}

      {/* Vorschläge */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Vorschläge ({matches.length})</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-neutral-400">Keine offenen Match-Vorschläge.</p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <div key={m.voucherId + m.transactionId} className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3">
                <div className="min-w-[220px] flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/belege/${m.voucherId}`} className="font-medium hover:underline">
                      {m.voucherLabel}
                    </Link>
                    {m.fx && <Badge tone="blue">FX → EUR</Badge>}
                  </div>
                  <div className="text-xs text-neutral-500">
                    Beleg {formatDate(m.voucherDateISO)} · {m.fx ? "Betrag folgt aus Bank" : formatEur(m.voucherAmountCents)}
                  </div>
                </div>
                <div className="text-neutral-300">↔</div>
                <div className="min-w-[220px] flex-1">
                  <div className="font-medium">{m.txLabel}</div>
                  <div className="text-xs text-neutral-500">
                    Buchung {formatDate(m.txDateISO)} · {formatEur(m.txAmountCents)}
                  </div>
                </div>
                <Badge tone={m.confidence >= 85 ? "green" : "amber"}>{m.confidence}%</Badge>
                <button
                  disabled={pending}
                  onClick={() => run(() => confirmMatch(m.voucherId, m.transactionId, m.confidence))}
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {m.fx ? "Zuordnen + EUR übernehmen" : "Zuordnen"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Buchungen ohne Beleg */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Buchungen ohne Beleg ({missingTx.length}) — „bitte nachreichen"
        </h2>
        {missingTx.length === 0 ? (
          <p className="text-sm text-neutral-400">Alle Abbuchungen haben einen Beleg.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {missingTx.map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 text-sm last:border-0">
                <div>
                  <span className="font-medium">{t.label}</span>
                  <span className="ml-2 text-xs text-neutral-500">
                    {formatDate(t.dateISO)}
                    {t.purpose ? ` · ${t.purpose}` : ""}
                  </span>
                </div>
                <span className="tabular-nums text-red-700">{formatEur(t.amountCents)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Belege ohne Buchung */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Belege ohne Buchung ({missingVoucher.length})
        </h2>
        {missingVoucher.length === 0 ? (
          <p className="text-sm text-neutral-400">Alle Belege sind zugeordnet oder privat bezahlt.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {missingVoucher.map((v) => (
              <div key={v.id} className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 text-sm last:border-0">
                <div>
                  <Link href={`/belege/${v.id}`} className="font-medium hover:underline">
                    {v.label}
                  </Link>
                  <span className="ml-2 text-xs text-neutral-500">{formatDate(v.dateISO)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums">{formatEur(v.amountCents)}</span>
                  <button
                    disabled={pending}
                    onClick={() => run(() => markPrivate(v.id))}
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
                  >
                    privat bezahlt
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Duplikate */}
      {duplicates.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Mögliche Duplikate ({duplicates.length})</h2>
          <div className="space-y-2">
            {duplicates.map((d) => (
              <div key={d.key} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                {d.vouchers.map((v, i) => (
                  <span key={v.id}>
                    {i > 0 && <span className="text-neutral-400"> · </span>}
                    <Link href={`/belege/${v.id}`} className="font-medium hover:underline">
                      {v.label}
                    </Link>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
