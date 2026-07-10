import { prisma } from "@/lib/db";
import { readFile } from "node:fs/promises";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await prisma.voucherFile.findUnique({ where: { id } });
  if (!file) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(file.storagePath);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": file.mimeType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName ?? "beleg")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Datei nicht lesbar", { status: 410 });
  }
}
