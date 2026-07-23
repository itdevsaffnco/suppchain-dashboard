import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { seedData } from "@/lib/dashboard";
import { listUsers } from "@/lib/userStore";

export const dynamic = "force-dynamic";

// Returns the dashboard dataset. Falls back to the bundled seed data when no
// Google Apps Script backend is configured, so the app runs out of the box.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // When a Sheets backend is wired up, fetch + map it here. For now, seed data.
  const data = seedData();
  // Users come from the live server store so user-management changes persist.
  data.users = listUsers();
  return NextResponse.json(data);
}
