"use client";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ from }: { from: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold">Beleg-Prüfung</h1>
      <p className="mt-1 text-sm text-neutral-500">Bitte anmelden.</p>
      <input type="hidden" name="from" value={from} />
      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">Passwort</span>
        <input
          type="password"
          name="password"
          autoFocus
          autoComplete="current-password"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-300"
        />
      </label>
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      <button
        disabled={pending}
        className="mt-4 w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {pending ? "Anmelden…" : "Anmelden"}
      </button>
    </form>
  );
}
