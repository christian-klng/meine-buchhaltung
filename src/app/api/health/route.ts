// Öffentlicher Health-Check für Coolify (von der Auth-Middleware ausgenommen).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
