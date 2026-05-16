import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./profile-form";

export default async function RooferProfilePage() {
  const session = await auth();
  const userId = session!.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, company: true, postcode: true, phone: true, verified: true },
  });

  if (!user) return null;

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile</h1>
      <p className="text-gray-500 mb-8">
        Keep your details up to date so we can match you with the right leads.
      </p>

      {user.verified && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 mb-8 flex items-center gap-2">
          <span className="text-green-600 font-bold text-lg">✓</span>
          <p className="text-green-800 text-sm font-medium">Verified roofer — your profile badge is active</p>
        </div>
      )}

      <div className="bg-white border rounded-xl p-6">
        <ProfileForm profile={user} />
      </div>
    </div>
  );
}
