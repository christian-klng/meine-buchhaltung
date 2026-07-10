// Dateiablage für Original-Belege (GoBD: Original nie verändern). Sicherheit (Review D5):
// Ablage unter sha256-basiertem Namen — nie unter dem Client-Dateinamen (kein Pfad-Traversal).
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

export interface StoredFile {
  storagePath: string;
  sha256: string;
  sizeBytes: number;
}

export function hashBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

const ALLOWED_EXT = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);

export async function saveUpload(buf: Buffer, originalName: string): Promise<StoredFile> {
  const sha256 = hashBuffer(buf);
  await mkdir(UPLOAD_DIR, { recursive: true });
  const rawExt = extname(originalName).toLowerCase();
  const ext = ALLOWED_EXT.has(rawExt) ? rawExt : "";
  const storagePath = join(UPLOAD_DIR, `${sha256}${ext}`);
  await writeFile(storagePath, buf);
  return { storagePath, sha256, sizeBytes: buf.length };
}
