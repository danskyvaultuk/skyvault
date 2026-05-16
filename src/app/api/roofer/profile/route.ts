import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(1).max(100),
  company: z.string().max(100).optional().nullable(),
  postcode: z.string().max(10).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "roofer" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: parsed.data.name,
      company: parsed.data.company ?? null,
      postcode: parsed.data.postcode ?? null,
      phone: parsed.data.phone ?? null,
    },
    select: { id: true, name: true, company: true, postcode: true, phone: true, email: true },
  });

  return NextResponse.json(user);
}
