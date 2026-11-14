import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_BYTES = 2 * 1024 * 1024;

/** Identify the real image type from the first bytes, not from the file name the browser sent. */
function sniff(b: Buffer): "jpg" | "png" | "webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length > 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

/**
 * Saves an uploaded photo under public/uploads/<folder>/ and returns its public path.
 * shortcut: local disk, works for `next dev` and a self-hosted server that can write to
 * public/. Move to object storage (e.g. Cloudinary) before deploying to a read-only host.
 */
export async function saveImage(file: File, folder: "doctors" | "treatments"): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (file.size > MAX_BYTES) return { ok: false, error: "The photo is too large. Use a JPG, PNG or WebP under 2 MB." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = sniff(bytes);
  if (!ext) return { ok: false, error: "That file is not a JPG, PNG or WebP image." };
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await fs.mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, name), bytes);
  return { ok: true, url: `/uploads/${folder}/${name}` };
}
