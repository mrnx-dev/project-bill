import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getClientInvoices } from "@/lib/client-portal-queries";

export async function GET() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getClientInvoices(session));
}