/**
 * Password hashing with PBKDF2-SHA512 (Web Crypto, so it runs the same on Node and Cloudflare Workers).
 * Cloudflare Workers allow at most 100,000 PBKDF2 iterations, so that is the cost used. Combined with the
 * sign-in lockout and long passwords this is adequate; move to Argon2 if the app is ever hosted on plain Node.
 */
const ITERATIONS = 100_000;
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64url");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-512", salt: salt as BufferSource, iterations }, key, 512));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha512$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2-sha512" || !iterations || !salt || !hash) return false;
  const expected = unb64(hash);
  const actual = await derive(password, unb64(salt), Number(iterations));
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]; // constant time
  return diff === 0;
}

const COMMON = new Set(["password", "password1", "password123", "1234567890", "qwertyuiop", "admin12345", "letmein123", "welcome123", "iloveyou12"]);

/** Returns a message when the password is not acceptable, otherwise null. */
export function passwordProblem(password: string, username: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 200) return "That password is too long.";
  if (password.toLowerCase() === username.toLowerCase()) return "The password cannot be the same as the username.";
  if (COMMON.has(password.toLowerCase())) return "That password is too common. Choose something harder to guess.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Use both letters and numbers.";
  return null;
}
