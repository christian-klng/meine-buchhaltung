"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { COUNTRY_ZONES, zoneShort, zoneLabel, type CountryZone } from "@/lib/country-zone";
import { saveVendorRule, type VendorRulePayload } from "./actions";

export interface RuleRow {
  id: string;
  contactName: string;
  countryZone: CountryZone | null;
  defaultCategoryId: string | null;
  splitType: "none" | "split_70_30";
  businessPercent: number | null;
  businessCategoryId: string | null;
  privatCategoryId: string | null;
  currency: string;
  reverseCharge: "ja" | "nein" | "pruefen";
  reverseChargeVatRate: number;
  locked: boolean;
}

interface CategoryOption {
  id: string;
  name: string;
}

function RcBadge({ flag }: { flag: "ja" | "nein" | "pruefen" }) {
  if (flag === "ja") return <Badge tone="red">Ja</Badge>;
  if (flag === "pruefen") return <Badge tone="amber">Prüfen</Badge>;
  return <Badge tone="neutral">Nein</Badge>;
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

export function LieferantenMatrix({ rows, categories }: { rows: RuleRow[]; categories: CategoryOption[] }) {
  const [editing, setEditing] = useState<RuleRow | null>(null);
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3 font-medium">Lieferant</th>
              <th className="px-3 py-3 font-medium">Land</th>
              <th className="px-3 py-3 font-medium">Kategorie</th>
              <th className="px-3 py-3 font-medium">Split</th>
              <th className="px-3 py-3 font-medium">Währung</th>
              <th className="px-3 py-3 font-medium">§ 13b</th>
              <th className="px-3 py-3 font-medium">Satz</th>
              <th className="px-3 py-3 font-medium text-right">Bearbeiten</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((r) => {
              const split =
                r.splitType === "split_70_30" && r.businessCategoryId && r.privatCategoryId
                  ? `${r.businessPercent ?? 70}% ${catName(r.businessCategoryId)} / ${100 - (r.businessPercent ?? 70)}% ${catName(r.privatCategoryId)}`
                  : null;
              return (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5 font-medium text-neutral-900">{r.contactName}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-neutral-500">{r.countryZone ? zoneShort[r.countryZone] : "–"}</td>
                  <td className="px-3 py-2.5 text-neutral-700">
                    {catName(r.defaultCategoryId) ?? <span className="text-neutral-400 italic">von dir</span>}
                  </td>
                  <td className="px-3 py-2.5 text-neutral-700">{split ?? <span className="text-neutral-400">–</span>}</td>
                  <td className="px-3 py-2.5">
                    {r.currency === "EUR" ? <span className="text-neutral-600">EUR</span> : <Badge tone="blue">{r.currency}</Badge>}
                  </td>
                  <td className="px-3 py-2.5">
                    <RcBadge flag={r.reverseCharge} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-neutral-600">{r.reverseCharge === "ja" ? `${r.reverseChargeVatRate} %` : "–"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      {r.locked && <Badge tone="neutral">🔒 Seed</Badge>}
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        title="Bearbeiten"
                        aria-label={`${r.contactName} bearbeiten`}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                      >
                        <PencilIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && <EditModal key={editing.id} rule={editing} categories={categories} onClose={() => setEditing(null)} />}
    </>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={"block" + (wide ? " col-span-2" : "")}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function EditModal({ rule, categories, onClose }: { rule: RuleRow; categories: CategoryOption[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(rule.contactName);
  const [countryZone, setCountryZone] = useState<CountryZone | "">(rule.countryZone ?? "");
  const [defaultCategoryId, setDefaultCategoryId] = useState(rule.defaultCategoryId ?? "");
  const [splitType, setSplitType] = useState<RuleRow["splitType"]>(rule.splitType);
  const [businessPercent, setBusinessPercent] = useState(rule.businessPercent ?? 70);
  const [businessCategoryId, setBusinessCategoryId] = useState(rule.businessCategoryId ?? "");
  const [privatCategoryId, setPrivatCategoryId] = useState(rule.privatCategoryId ?? "");
  const [currency, setCurrency] = useState(rule.currency);
  const [reverseCharge, setReverseCharge] = useState<RuleRow["reverseCharge"]>(rule.reverseCharge);
  const [rcRate, setRcRate] = useState(rule.reverseChargeVatRate);

  const isSplit = splitType === "split_70_30";
  const currencyOptions = Array.from(new Set(["EUR", "USD", "GBP", "CHF", rule.currency]));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    setError(null);
    const payload: VendorRulePayload = {
      name,
      countryZone: countryZone || null,
      defaultCategoryId: defaultCategoryId || null,
      splitType,
      businessPercent: isSplit ? businessPercent : null,
      businessCategoryId: isSplit ? businessCategoryId || null : null,
      privatCategoryId: isSplit ? privatCategoryId || null : null,
      currency,
      reverseCharge,
      reverseChargeVatRate: rcRate,
    };
    startTransition(async () => {
      const res = await saveVendorRule(rule.id, payload);
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Lieferant bearbeiten"
    >
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5">
          <h2 className="text-base font-semibold">Lieferant bearbeiten</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="Schließen">
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
          {rule.locked && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
              Kuratierte Seed-Regel. Deine manuellen Änderungen bleiben erhalten und werden nicht durch Auto-Lernen überschrieben.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Lieferant" wide>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
            </Field>
            <Field label="Land / Zone">
              <select value={countryZone} onChange={(e) => setCountryZone(e.target.value as CountryZone | "")} className="input">
                <option value="">— nicht gesetzt —</option>
                {COUNTRY_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {zoneLabel[z]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Währung">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input">
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Kategorie (Standard)" wide>
              <select value={defaultCategoryId} onChange={(e) => setDefaultCategoryId(e.target.value)} className="input">
                <option value="">— von dir zu wählen —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Aufteilung / Split */}
          <div className="space-y-3 rounded-lg border border-neutral-200 p-4">
            <Field label="Aufteilung">
              <select value={splitType} onChange={(e) => setSplitType(e.target.value as RuleRow["splitType"])} className="input">
                <option value="none">Kein Split (voller Betrag)</option>
                <option value="split_70_30">Betrieb / Privat aufteilen</option>
              </select>
            </Field>
            {isSplit && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Betriebsanteil (%)">
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={businessPercent}
                    onChange={(e) => setBusinessPercent(Number(e.target.value))}
                    className="input"
                  />
                </Field>
                <div className="flex items-end pb-1.5 text-xs text-neutral-500">Privat: {100 - businessPercent} %</div>
                <Field label="Betrieb → Kategorie">
                  <select value={businessCategoryId} onChange={(e) => setBusinessCategoryId(e.target.value)} className="input">
                    <option value="">— wählen —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Privat → Kategorie">
                  <select value={privatCategoryId} onChange={(e) => setPrivatCategoryId(e.target.value)} className="input">
                    <option value="">— wählen —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
          </div>

          {/* § 13b */}
          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="§ 13b Reverse-Charge">
                <select
                  value={reverseCharge}
                  onChange={(e) => setReverseCharge(e.target.value as RuleRow["reverseCharge"])}
                  className="input"
                >
                  <option value="nein">Nein</option>
                  <option value="ja">Ja (bestätigt)</option>
                  <option value="pruefen">Prüfen</option>
                </select>
              </Field>
              {reverseCharge === "ja" && (
                <Field label="USt-Satz (%)">
                  <input type="number" min={0} max={100} value={rcRate} onChange={(e) => setRcRate(Number(e.target.value))} className="input" />
                </Field>
              )}
            </div>
            {reverseCharge === "pruefen" && (
              <p className="mt-2 text-xs text-neutral-500">„Prüfen“ zählt bewusst nicht in die § 13b-Auswertung, bis der Steuerberater bestätigt.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-200 px-5 py-3.5">
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={save}
            disabled={pending || !name.trim()}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
          >
            {pending ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
