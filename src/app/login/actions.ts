"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSession, verifyPassword, safeRedirectPath } from "@/lib/auth";
import { rateLimitCheck, rateLimitFailure, rateLimitSuccess } from "@/lib/rate-limit";

export interface LoginState {
  error?: string;
}

const GLOBAL_KEY = "__global__";

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const from = safeRedirectPath(formData.get("from") ? String(formData.get("from")) : "/");

  const now = Date.now();
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

  // Lockout: pro IP UND global (fängt IP-Rotation ab; App ist Single-User).
  for (const key of [ip, GLOBAL_KEY]) {
    const rl = rateLimitCheck(key, now);
    if (rl.blocked) return { error: `Zu viele Fehlversuche. Bitte ${rl.retryAfterSec} s warten.` };
  }

  const ok = await verifyPassword(password, process.env.AUTH_PASSWORD);
  if (!ok) {
    rateLimitFailure(ip, now);
    rateLimitFailure(GLOBAL_KEY, now);
    await new Promise((r) => setTimeout(r, 400));
    return { error: "Falsches Passwort." };
  }
  rateLimitSuccess(ip);
  rateLimitSuccess(GLOBAL_KEY);

  const token = await createSession(process.env.AUTH_SECRET ?? "", now);
  // `Secure` NUR wenn die Verbindung tatsächlich HTTPS ist — sonst sendet der Browser das Cookie
  // über HTTP nie zurück (→ Dauer-Login). Schaltet automatisch auf Secure, sobald Coolify TLS macht.
  const isHttps = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https";
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(from);
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
