import { prisma } from "@/lib/db";
import { SignFlow } from "./sign-flow";

export const dynamic = "force-dynamic";

export default async function PublicSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const req = await prisma.orderSignatureRequest.findUnique({
    where: { token },
    include: {
      order: {
        include: {
          workshop: {
            select: {
              name: true,
              street: true,
              zip: true,
              city: true,
              contactEmail: true,
              contactPhone: true,
              letterheadLogo: true,
              letterheadLogoMime: true,
              brandPrimary: true,
            },
          },
          customer: true,
          vehicle: true,
        },
      },
    },
  });

  if (!req) {
    return (
      <Wrapper>
        <ErrorCard title="Ungültiger Link" message="Diese Signatur-Anfrage existiert nicht (mehr)." />
      </Wrapper>
    );
  }
  const expired = req.tokenExpiresAt < new Date();
  if (expired && req.status === "pending") {
    // Auto-mark expired
    await prisma.orderSignatureRequest.update({ where: { id: req.id }, data: { status: "expired" } });
  }

  if (req.status === "signed") {
    return (
      <Wrapper>
        <SignedCard order={req.order} signedAt={req.respondedAt} name={req.signedByName ?? ""} />
      </Wrapper>
    );
  }
  if (req.status !== "pending" || expired) {
    return (
      <Wrapper>
        <ErrorCard
          title={expired ? "Link abgelaufen" : "Anfrage nicht mehr aktiv"}
          message={
            expired
              ? "Der Freigabe-Link ist nicht mehr gültig. Bitte fordern Sie bei der Werkstatt einen neuen Link an."
              : "Diese Signatur-Anfrage wurde zurückgezogen oder abgeschlossen."
          }
        />
      </Wrapper>
    );
  }

  const logoDataUrl =
    req.order.workshop.letterheadLogo && req.order.workshop.letterheadLogoMime
      ? `data:${req.order.workshop.letterheadLogoMime};base64,${Buffer.from(req.order.workshop.letterheadLogo).toString("base64")}`
      : null;

  return (
    <Wrapper>
      <SignFlow
        token={token}
        order={{
          id: req.order.id,
          orderNumber: req.order.orderNumber,
          approvedAmountCent: req.approvedAmountCent ?? req.order.approvedAmountCent ?? req.totalGrossCent ?? 0,
          approvalFreetext: req.approvalFreetext ?? req.order.approvalFreetext ?? "",
          positions: (req.positionsSnapshot ?? req.order.positions) as any[],
          totalGrossCent: req.totalGrossCent ?? req.order.totalGrossCent,
          notes: req.order.notes,
        }}
        customer={req.order.customer}
        vehicle={req.order.vehicle}
        workshop={req.order.workshop}
        logoDataUrl={logoDataUrl}
      />
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <img src="/werkstattconnect-logo.svg" alt="WerkstattConnect" className="h-8 w-auto mx-auto opacity-80" />
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
      <p className="text-slate-600">{message}</p>
    </div>
  );
}

function SignedCard({
  order,
  signedAt,
  name,
}: {
  order: { orderNumber: string; workshop: { name: string } };
  signedAt: Date | null;
  name: string;
}) {
  return (
    <div className="bg-white border border-emerald-200 rounded-2xl p-8 text-center shadow-sm">
      <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto mb-4 flex items-center justify-center text-3xl">
        ✓
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Vielen Dank!</h1>
      <p className="text-slate-600 mb-4">
        Sie haben Auftrag <strong>{order.orderNumber}</strong> bei{" "}
        <strong>{order.workshop.name}</strong> freigegeben.
      </p>
      {signedAt && (
        <p className="text-xs text-slate-400">
          Signiert von {name} am {signedAt.toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" })}
        </p>
      )}
    </div>
  );
}
