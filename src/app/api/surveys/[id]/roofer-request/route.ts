import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyAdminRooferRequest } from "@/lib/resend";
import { RooferRequests, adminEmailAddress, type RooferRequestResult } from "@/lib/rooferRequest";

const REQUEST_SELECT = { status: true, createdAt: true } as const;

function buildRooferRequests(): RooferRequests {
  return new RooferRequests({
    findSurvey: (id) =>
      prisma.survey.findUnique({
        where: { id },
        select: {
          id: true,
          customerId: true,
          property: { select: { address: true, postcode: true } },
          customer: { select: { name: true, email: true } },
          report: { select: { id: true, status: true } },
        },
      }),
    findRequest: (surveyId) => prisma.lead.findUnique({ where: { surveyId }, select: REQUEST_SELECT }),
    createRequest: (data) => prisma.lead.create({ data, select: REQUEST_SELECT }),
    notifyAdmin: (notice) =>
      notifyAdminRooferRequest({ to: adminEmailAddress(process.env.SKYVAULT_ADMIN_EMAIL), ...notice }),
  });
}

const STATUS = { created: 201, exists: 200, "consent-required": 400, "not-found": 404, "not-released": 409 } as const;

function respond(result: RooferRequestResult): NextResponse {
  const body = "request" in result ? result.request : { error: result.outcome };
  return NextResponse.json(body, { status: STATUS[result.outcome] });
}

// A customer asks to be put in touch with a roofer (BL-060).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body: unknown = await req.json().catch(() => null);
  const consent = body && typeof body === "object" ? (body as { consent?: unknown }).consent : undefined;
  return respond(await buildRooferRequests().request(id, session.user.id, consent));
}
