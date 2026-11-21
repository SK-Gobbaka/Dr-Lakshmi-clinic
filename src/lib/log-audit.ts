import { sql } from "./db";

/** Adds one line to the audit log (Admin > Audit log). Used for actions outside the booking rules, such as data downloads. */
export async function logAudit(actor: string, action: string, summary: string, entityId?: string): Promise<void> {
  await sql()`insert into audit_log (actor, action, entity_id, summary) values (${actor}, ${action}, ${entityId ?? null}, ${summary})`;
}
