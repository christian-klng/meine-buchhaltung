"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveVoucher, confirmVoucher, applyFx, type ReviewPayload, type ReviewItem } from "./actions";

interface Option {
  id: string;
  name: string;
}

export interface ReviewFormProps {
  voucher: {
    id: string;
    dateISO: string;
    voucherNumber: string | null;
    amountCents: number;
    currency: string;
    contactId: string | null;
    status: string;
    reverseCharge: "ja" | "nein" | "pruefen";
    reverseChargeVatRate: number | null;
    paidPrivately: boolean;
    remark: string | null;
    originalAmountCents: number | null;
    items: ReviewItem[];
  };
  categories: Option[];
  contacts: Option[];
}

const eur = (cents: number) => (cents / 100).toFixed(2);
const toCents = (v: string) => Math.round((parseFloat(v.replace(",", ".")) || 0) * 100);

export function ReviewForm({ voucher, categories, contacts }: ReviewFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [dateISO, setDateISO] = useState(voucher.dateISO);
  const [voucherNumber, setVoucherNumber] = useState(voucher.voucherNumber ?? "");
  const [amountCents, setAmountCents] = useState(voucher.amountCents);
  const [currency, setCurrency] = useState(voucher.currency);
  const [contactId, setContactId] = useState(voucher.contactId ?? "");
  const [reverseCharge, setReverseCharge] = useState(voucher.reverseCharge);
  const [rcRate, setRcRate] = useState(voucher.reverseChargeVatRate ?? 19);
  const [paidPrivately, setPaidPrivately] = useState(voucher.paidPrivately);
  const [remark, setRemark] = useState(voucher.remark ?? "");
  const [items, setItems] = useState<ReviewItem[]>(voucher.items);
  const [fxEur, setFxEur] = useState("");

  const isFx = voucher.status === "awaiting_fx";
  const itemsSum = items.reduce((s, i) => s + i.amountCents, 0);
  const sumOk = itemsSum === amountCents;

  const payload = (): ReviewPayload => ({
    dateISO,
    voucherNumber: voucherNumber || null,
    amountCents,
    currency,
    contactId: contactId || null,
    reverseCharge,
    reverseChargeVatRate: rcRate,
    paidPrivately,
    remark: remark || null,
    items,
  });

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setOkMsg("Gespeichert.");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  const setItem = (idx: number, patch: Partial<ReviewItem>) =>
    setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-5">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
      {okMsg && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 ring-1 ring-green-200">{okMsg}</div>}

      {isFx && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-900">Fremdwährung ({voucher.currency}) — wartet auf EUR-Bankbetrag</p>
          <p className="mt-1 text-xs text-blue-700">
            Der extrahierte Betrag ist der falsche 1:1-Wert. Trage den tatsächlich abgebuchten EUR-Betrag ein (aus dem Bankauszug).
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              value={fxEur}
              onChange={(e) => setFxEur(e.target.value)}
              placeholder="EUR-Betrag"
              className="w-40 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            />
            <button
              disabled={pending || !fxEur}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await applyFx(voucher.id, toCents(fxEur));
                  // Betrag/Währung/Positionen ändern sich serverseitig → Formular komplett neu laden.
                  if (res.ok) window.location.reload();
                  else setError(res.error);
                });
              }}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              EUR-Betrag übernehmen
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Lieferant">
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="input">
            <option value="">— nicht zugeordnet —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Datum">
          <input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} className="input" />
        </Field>
        <Field label="Beleg-Nr.">
          <input value={voucherNumber} onChange={(e) => setVoucherNumber(e.target.value)} className="input" />
        </Field>
        <Field label={`Betrag (${currency})`}>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={eur(amountCents)}
              disabled={isFx}
              onChange={(e) => setAmountCents(toCents(e.target.value))}
              className="input flex-1 disabled:bg-neutral-100"
            />
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={isFx} className="input w-24 disabled:bg-neutral-100">
              <option>EUR</option>
              <option>USD</option>
              <option>GBP</option>
            </select>
          </div>
        </Field>
      </div>

      {/* § 13b */}
      <div className="rounded-lg border border-neutral-200 p-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="§ 13b Reverse-Charge">
            <select value={reverseCharge} onChange={(e) => setReverseCharge(e.target.value as typeof reverseCharge)} className="input">
              <option value="nein">Nein</option>
              <option value="ja">Ja (bestätigt)</option>
              <option value="pruefen">Prüfen</option>
            </select>
          </Field>
          {reverseCharge === "ja" && (
            <Field label="USt-Satz (%)">
              <input type="number" value={rcRate} onChange={(e) => setRcRate(Number(e.target.value))} className="input" />
            </Field>
          )}
        </div>
        {reverseCharge === "ja" && currency === "EUR" && (
          <p className="mt-2 text-xs text-neutral-500">
            Geschuldete USt: {eur(Math.round((amountCents * rcRate) / 100))} € (Basis {eur(amountCents)} € × {rcRate} %)
          </p>
        )}
      </div>

      {/* Positionen / Split */}
      {!isFx && (
        <div className="rounded-lg border border-neutral-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Positionen</span>
            <span className={"text-xs font-medium " + (sumOk ? "text-green-600" : "text-red-600")}>
              Σ {eur(itemsSum)} / {eur(amountCents)} {sumOk ? "✓" : "≠ Brutto"}
            </span>
          </div>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select value={it.categoryId} onChange={(e) => setItem(idx, { categoryId: e.target.value })} className="input flex-1">
                  <option value="">— Kategorie —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  value={it.note ?? ""}
                  onChange={(e) => setItem(idx, { note: e.target.value || null })}
                  placeholder="Notiz"
                  className="input w-32"
                />
                <input
                  type="number"
                  step="0.01"
                  value={eur(it.amountCents)}
                  onChange={(e) => setItem(idx, { amountCents: toCents(e.target.value) })}
                  className="input w-28 text-right"
                />
                <button onClick={() => setItems((xs) => xs.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-600" title="entfernen">
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setItems((xs) => [...xs, { categoryId: categories[0]?.id ?? "", amountCents: Math.max(0, amountCents - itemsSum), note: null }])}
              className="text-sm text-blue-600 hover:underline"
            >
              + Position
            </button>
          </div>
        </div>
      )}

      <Field label="Notiz / remark">
        <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} className="input" />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={paidPrivately} onChange={(e) => setPaidPrivately(e.target.checked)} />
        Privat bezahlt (kein Bank-Match nötig)
      </label>

      {!isFx && (
        <div className="flex gap-3 pt-2">
          <button
            disabled={pending}
            onClick={() => run(() => saveVoucher(voucher.id, payload()))}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
          >
            Speichern
          </button>
          <button
            disabled={pending || !sumOk || amountCents <= 0 || !contactId || items.length === 0}
            onClick={() => run(() => confirmVoucher(voucher.id, payload()))}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
            title={!sumOk ? "Summen-Invariante verletzt" : ""}
          >
            Bestätigen (geprüft)
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
