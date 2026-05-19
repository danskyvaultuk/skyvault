import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AuthRedirectPage() {
  const session = await auth();
  if (!session) redirect("/login");

  switch (session.user.role) {
    case "admin":  redirect("/admin/dashboard");
    case "roofer": redirect("/roofer/dashboard");
    case "drone":  redirect("/drone/dashboard");
    default:       redirect("/dashboard");
  }
}
