import { getSession } from "@/lib/session";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  return <Dashboard initialSession={session} />;
}
