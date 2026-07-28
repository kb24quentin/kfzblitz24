import Link from "next/link";
import { prisma } from "@/lib/db";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await prisma.workshopUser.findUnique({
    where: { passwordSetupToken: token },
    include: { workshop: { select: { name: true } } },
  });

  const expired =
    !user ||
    !user.passwordSetupExpires ||
    user.passwordSetupExpires.getTime() < Date.now() ||
    !user.active;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <img
              src="/werkstattconnect-logo.svg"
              alt="WerkstattConnect"
              className="h-16 w-auto mx-auto"
            />
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          {expired ? (
            <>
              <h1 className="text-lg font-semibold text-slate-900 mb-1">Link abgelaufen</h1>
              <p className="text-sm text-slate-500 mb-5">
                Dieser Setup-Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link
                bei Ihrem Admin an.
              </p>
              <Link
                href="/login"
                className="inline-block px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold"
              >
                Zum Login
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-slate-900 mb-1">Passwort festlegen</h1>
              <p className="text-sm text-slate-500 mb-5">
                Willkommen <strong>{user.name}</strong> · {user.workshop.name}
                <br />
                Legen Sie ein Passwort fest, um sich einzuloggen.
              </p>
              <SetupForm token={token} email={user.email} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
