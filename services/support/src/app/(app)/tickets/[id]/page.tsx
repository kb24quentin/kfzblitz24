import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { TicketDetail } from "./ticket-detail";
import { fieldsForUser, renderSignatureHtml } from "@/lib/signature";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const currentUser = session?.user?.email
    ? await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { signature: true },
      })
    : null;
  const currentUserSignatureHtml = currentUser
    ? renderSignatureHtml(
        fieldsForUser(
          { name: currentUser.name, role: currentUser.role },
          currentUser.signature
            ? {
                displayName: currentUser.signature.displayName,
                position: currentUser.signature.position,
              }
            : null,
        ),
      )
    : null;

  const [ticket, users, templates] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id },
      include: {
        contact: true,
        assignee: true,
        orders: { orderBy: { createdAt: "asc" } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            authorUser: { select: { id: true, name: true, email: true } },
          },
        },
        notes: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        drafts: {
          where: { status: { in: ["pending", "approved"] } },
          orderBy: { createdAt: "desc" },
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { user: { select: { name: true, email: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.template.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        shortcode: true,
        subject: true,
        bodyHtml: true,
        category: true,
      },
    }),
  ]);

  if (!ticket) notFound();

  return (
    <TicketDetail
      ticket={{
        ...ticket,
        firstResponseDueAt: ticket.firstResponseDueAt.toISOString(),
        resolutionDueAt: ticket.resolutionDueAt.toISOString(),
        firstResponseAt: ticket.firstResponseAt?.toISOString() || null,
        resolvedAt: ticket.resolvedAt?.toISOString() || null,
        snoozedUntil: ticket.snoozedUntil?.toISOString() || null,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        orders: ticket.orders.map((o) => {
          let beleg: ReturnType<typeof safeParseBeleg> = null;
          if (o.webiscoData) beleg = safeParseBeleg(o.webiscoData);
          return {
            id: o.id,
            ref: o.ref,
            note: o.note,
            source: o.source,
            emailMatched: o.emailMatched,
            status: o.status,
            totalBrutto: o.totalBrutto,
            fetchedAt: o.fetchedAt?.toISOString() || null,
            createdAt: o.createdAt.toISOString(),
            beleg,
            retoureCaseId: o.retoureCaseId,
            retoureAnmeldungUrl: o.retoureAnmeldungUrl,
            retoureLabelUrl: o.retoureLabelUrl,
            retoureCreatedAt: o.retoureCreatedAt?.toISOString() || null,
            retoureFreeLabel: o.retoureFreeLabel,
          };
        }),
        messages: ticket.messages.map((m) => ({
          ...m,
          sentAt: m.sentAt?.toISOString() || null,
          createdAt: m.createdAt.toISOString(),
          kind: m.kind,
          resentFromId: m.resentFromId,
          resendMessageId: m.resendMessageId,
        })),
        notes: ticket.notes.map((n) => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
        })),
        drafts: ticket.drafts.map((d) => ({
          ...d,
          createdAt: d.createdAt.toISOString(),
          reviewedAt: d.reviewedAt?.toISOString() || null,
        })),
        events: ticket.events.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        })),
      }}
      users={users}
      templates={templates}
      signatureHtml={currentUserSignatureHtml}
      currentUserRole={currentUser?.role ?? "agent"}
    />
  );
}

type BelegAddress = {
  anrede?: string;
  vorname?: string;
  name?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  email?: string;
  telefon?: string;
};

type BelegPosition = {
  id?: number;
  typ?: string;
  artikelnummer?: string;
  hersteller?: string;
  herstellernummer?: string;
  beschreibung?: string;
  menge?: number;
  einzelpreis_brutto?: number;
  positionspreis_brutto?: number;
  status?: string;
};

type BelegShape = {
  typ?: string;
  belegnummer?: string;
  belegdatum?: string;
  status?: string;
  bestellnummer?: string;
  endpreis_brutto?: number;
  endpreis_netto?: number;
  rechnungsadresse?: BelegAddress;
  lieferadresse?: BelegAddress;
  positionen?: BelegPosition[];
};

function safeParseBeleg(raw: string): BelegShape | null {
  try {
    return JSON.parse(raw) as BelegShape;
  } catch {
    return null;
  }
}
