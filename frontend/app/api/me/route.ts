import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 200 });
  // Only the public fields — the backend token stays server-side.
  return NextResponse.json({ user: { username: session.username, role: session.role } });
}
