import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(["customer", "roofer", "drone"]),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, name, role } = parsed.data;

  // Check if account already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 409 });
  }

  await prisma.user.create({
    data: { email, name, role },
  });

  return NextResponse.json({ ok: true });
}
