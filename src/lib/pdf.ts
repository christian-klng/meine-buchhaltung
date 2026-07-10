// PDF-Textlayer-Extraktion via unpdf. Bild-PDFs/Fotos liefern leeren Text → manuelle Erfassung.
import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}
