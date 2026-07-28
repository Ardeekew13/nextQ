import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const organiser = await getSessionFromCookies();
  if (!organiser) redirect("/login");

  return <DashboardShell organiserName={organiser.name}>{children}</DashboardShell>;
}
