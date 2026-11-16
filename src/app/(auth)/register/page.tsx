import { Suspense } from "react";
import { redirect } from "next/navigation";
import { journeys } from "@/lib/journeys";
import { openSignUpRole } from "@/lib/signUpRole";
import { RegisterForm } from "./register-form";

// Customers, and the roles of switched-off journeys, go to the one sign-in page
// (BL-081 / SPEC-030 A3); roofers and drone operators sign up here while their
// journey is on.
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  if (!openSignUpRole(role, journeys)) redirect("/login");
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
