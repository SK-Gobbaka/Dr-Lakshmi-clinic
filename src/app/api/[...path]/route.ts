import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Any unknown /api address answers with JSON, not the website's HTML 404 page. Real routes take precedence over this one. */
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const HEAD = notFound;
export const OPTIONS = notFound;
