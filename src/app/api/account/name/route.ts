// Saves the signed-in user's own name (BL-081 / SPEC-030 B2, B4): the name step
// shown to a customer who has none.
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DisplayNameSchema } from "@/lib/displayName";

const BodySchema = z.object({ name: DisplayNameSchema });

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please enter your name." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { name: parsed.data.name } });
  return NextResponse.json({ ok: true });
}
