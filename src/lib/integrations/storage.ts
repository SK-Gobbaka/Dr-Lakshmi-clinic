import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../env";
import { log } from "../logger";

/**
 * Photo storage. With SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set, photos go to a public Supabase Storage
 * bucket (SUPABASE_STORAGE_BUCKET, default "clinic-media": create it in Supabase > Storage and mark it public).
 * Without them, photos are written to public/uploads/ when running on a normal server (local development),
 * and uploads are refused with a clear message on Cloudflare Workers, which has no disk.
 */
const MAX_BYTES = 2 * 1024 * 1024;
export type UploadFolder = "doctors" | "treatments" | "gallery";

const TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

/** Identify the real image type from the first bytes, not from the file name the browser sent. */
function sniff(b: Buffer): keyof typeof TYPES | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length > 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

export const storageConfigured = () => !!(env().SUPABASE_URL && env().SUPABASE_SERVICE_ROLE_KEY);
const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
const base = () => env().SUPABASE_URL!.replace(/\/$/, "");

/** Where uploads go right now: Supabase Storage, this computer's disk (development), or nowhere (a Worker without storage settings). */
export const storageMode = (): "supabase" | "disk" | "none" => (storageConfigured() ? "supabase" : onWorkers ? "none" : "disk");

export async function saveImage(file: File, folder: UploadFolder): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (file.size > MAX_BYTES) return { ok: false, error: "The photo is too large. Use a JPG, PNG or WebP under 2 MB." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = sniff(bytes);
  if (!ext) return { ok: false, error: "That file is not a JPG, PNG or WebP image." };
  const name = `${crypto.randomUUID()}.${ext}`;

  if (storageConfigured()) {
    const e = env();
    try {
      const res = await fetch(`${base()}/storage/v1/object/${e.SUPABASE_STORAGE_BUCKET}/${folder}/${name}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`, apikey: e.SUPABASE_SERVICE_ROLE_KEY!, "Content-Type": TYPES[ext], "x-upsert": "false", "Cache-Control": "max-age=31536000" },
        body: bytes,
      });
      if (!res.ok) {
        log.warn("storage.upload_failed", { status: res.status });
        return { ok: false, error: "The photo could not be saved to storage. Check the Supabase bucket settings." };
      }
      return { ok: true, url: `${base()}/storage/v1/object/public/${e.SUPABASE_STORAGE_BUCKET}/${folder}/${name}` };
    } catch (err) {
      log.error("storage.unreachable", err);
      return { ok: false, error: "Photo storage could not be reached. Please try again." };
    }
  }

  if (onWorkers) return { ok: false, error: "Photo upload is not set up yet. Add the Supabase storage settings (see Admin > Integrations), or save without a photo." };
  try {
    const dir = path.join(process.cwd(), "public", "uploads", folder);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), bytes);
    return { ok: true, url: `/uploads/${folder}/${name}` };
  } catch (err) {
    log.error("storage.disk_failed", err);
    return { ok: false, error: "The photo could not be saved on this server." };
  }
}

/** Best-effort removal of a photo this app stored. Never throws. */
export async function deleteImage(url: string): Promise<void> {
  try {
    if (!url) return;
    const e = env();
    const marker = `/storage/v1/object/public/${e.SUPABASE_STORAGE_BUCKET}/`;
    if (storageConfigured() && url.includes(marker)) {
      const key = url.split(marker)[1];
      await fetch(`${base()}/storage/v1/object/${e.SUPABASE_STORAGE_BUCKET}/${key}`, { method: "DELETE", headers: { Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`, apikey: e.SUPABASE_SERVICE_ROLE_KEY! } });
    } else if (url.startsWith("/uploads/") && !onWorkers) {
      const uploads = path.join(process.cwd(), "public", "uploads");
      const file = path.join(process.cwd(), "public", url);
      if (file.startsWith(uploads)) await fs.unlink(file);
    }
  } catch (err) {
    log.warn("storage.delete_failed", { error: String(err) });
  }
}
