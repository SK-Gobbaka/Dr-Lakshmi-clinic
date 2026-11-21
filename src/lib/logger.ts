/**
 * Structured server logs (one JSON object per line). Patient data stays out of them:
 * use maskPhone() for numbers and log ids, never names or message text.
 */
type Fields = Record<string, unknown>;

const errorFields = (e: unknown): Fields =>
  e instanceof Error ? { error: e.message, errorName: e.name, ...(((e as { code?: string }).code && { code: (e as { code?: string }).code }) || {}) } : { error: String(e) };

function write(level: "info" | "warn" | "error", event: string, fields: Fields) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...fields });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const log = {
  info: (event: string, fields: Fields = {}) => write("info", event, fields),
  warn: (event: string, fields: Fields = {}) => write("warn", event, fields),
  error: (event: string, e?: unknown, fields: Fields = {}) => write("error", event, { ...(e === undefined ? {} : errorFields(e)), ...fields }),
};

/** "98765 43210" -> "******3210" */
export const maskPhone = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.length <= 4 ? "****" : `${"*".repeat(d.length - 4)}${d.slice(-4)}`;
};
