import { auth } from "@/lib/auth";
import { journeys } from "@/lib/journeys";
import { redirect } from "next/navigation";

export default async function AuthRedirectPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Launch scope (BL-058): a roofer or drone account whose journey is off
  // reaches the not-available page, never its portal.
  switch (session.user.role) {
    case "admin":  redirect("/admin/dashboard");
    case "roofer": redirect(journeys.rooferEnabled ? "/roofer/dashboard" : "/unavailable");
    case "drone":  redirect(journeys.droneEnabled ? "/drone/dashboard" : "/unavailable");
    default:       redirect("/dashboard");
  }
}
