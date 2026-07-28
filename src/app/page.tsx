import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import HomeContent from "./HomeContent";

export default async function HomePage() {
  const organiser = await getSessionFromCookies();
  if (organiser) redirect("/dashboard");

  return <HomeContent />;
}
