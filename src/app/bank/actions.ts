"use server";
import { importBankFile } from "@/lib/bank/import";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function importBank(formData: FormData): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const buf = Buffer.from(await file.arrayBuffer());
  await importBankFile(buf, file.name);

  revalidatePath("/bank");
  revalidatePath("/abgleich");
  redirect("/abgleich");
}
