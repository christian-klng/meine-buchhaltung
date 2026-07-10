"use server";
import { ingestVoucher } from "@/lib/ingest";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function uploadVoucher(formData: FormData): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const buf = Buffer.from(await file.arrayBuffer());
  const res = await ingestVoucher(buf, file.name, file.type || "application/octet-stream");

  revalidatePath("/belege");
  redirect(`/belege/${res.voucherId}${res.duplicate ? "?dup=1" : ""}`);
}
