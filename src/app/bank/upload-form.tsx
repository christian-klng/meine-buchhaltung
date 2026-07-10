"use client";
import { useTransition } from "react";
import { importBank } from "./actions";

export function BankUploadForm() {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => start(() => importBank(fd))}
      className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-white p-4"
    >
      <input
        type="file"
        name="file"
        accept=".xml,.csv,text/csv,application/xml,text/xml"
        required
        className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-neutral-200"
      />
      <button
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {pending ? "Importiert…" : "Auszug importieren"}
      </button>
      <span className="text-xs text-neutral-400">camt.052/053 (XML) oder CSV — Format wird automatisch erkannt.</span>
    </form>
  );
}
