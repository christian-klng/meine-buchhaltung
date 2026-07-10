export { formatEur, formatAmount } from "./money";

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("de-DE").format(date);
}
