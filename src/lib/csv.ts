/** Quotes one CSV value and defuses spreadsheet formulas (a patient named "=HYPERLINK(...)" must not run in Excel). */
export function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** A CSV document with a byte-order mark so Excel reads UTF-8 names correctly. */
export const csv = (head: string[], rows: unknown[][]): string => "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

export function csvResponse(body: string, filename: string) {
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}
