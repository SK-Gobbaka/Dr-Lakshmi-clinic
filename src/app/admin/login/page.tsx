import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminLogin } from "@/actions/admin";
import { currentAdmin } from "@/lib/admin-auth";
import { Notice, btnPrimary, card, input, one, type SP } from "../ui";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  if (await currentAdmin()) redirect("/admin");
  const sp = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form action={adminLogin} className={`${card} w-full max-w-sm space-y-4 p-6`}>
        <h1 className="font-heading text-2xl font-semibold text-ink">Admin sign in</h1>
        <Notice error={one(sp.error)} />
        <label className="block text-sm font-semibold">
          Username
          <input name="username" autoComplete="username" required className={`${input} mt-1 w-full`} />
        </label>
        <label className="block text-sm font-semibold">
          Password
          <input name="password" type="password" autoComplete="current-password" required className={`${input} mt-1 w-full`} />
        </label>
        <button type="submit" className={`${btnPrimary} w-full`}>
          Sign in
        </button>
      </form>
    </div>
  );
}
