import { NextResponse } from "next/server";

// AI assistant is disabled in production — generic 404, no auth/DB/AI code.
export function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
