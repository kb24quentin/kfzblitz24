export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  ArrowLeft,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  Hash,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { StatusBadge, ScoreBadge } from "@/components/status-badge";
import {
  runAssessmentAction,
  decideCaseAction,
  addNoteAction,
  deleteDocumentAction,
} from "./actions";
import { DocUploadForm } from "./doc-upload";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await prisma.b2BCase.findUnique({
    where: { id },
    include: {
      events: { orderBy: { createdAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!c) notFound();

  let assessment: ParsedAssessment | null = null;
  if (c.assessmentJson) {
    try {
      assessment = JSON.parse(c.assessmentJson) as ParsedAssessment;
    } catch {
      assessment = null;
    }
  }

  const isAssessing = c.status === "assessing";

  return (
    <div className="space-y-6">
      {/* Auto-refresh while assessment is running */}
      {isAssessing && <meta httpEquiv="refresh" content="4" />}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-text-light hover:text-text"
          >
            <ArrowLeft className="w-4 h-4" /> Cases
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={c.status} />
          <ScoreBadge score={c.score} />
        </div>
      </div>

      {isAssessing && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-4 flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Bewertung läuft im Hintergrund…</p>
            <p className="text-sm">
              VIES, OSM-Geocoder, OpenAI-OCR &amp; Reputations-Recherche feuern parallel. Diese
              Seite aktualisiert sich automatisch.
            </p>
          </div>
        </div>
      )}

      <header className="bg-bg-card rounded-xl border border-border p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-text mb-1">
              <Building2 className="w-5 h-5 text-accent" />
              <h1 className="text-xl font-bold">{c.companyName}</h1>
            </div>
            <p className="text-sm text-text-light">
              {customerTypeLabel(c.customerType, c.businessSubtype)}
              {" · "}
              <span className="font-mono">{c.id}</span>
            </p>
          </div>
          <div className="text-xs text-text-light text-right">
            <p>Erstellt: {formatDateTime(c.createdAt)}</p>
            {c.source !== "form" && (
              <p>
                Quelle: <span className="font-mono">{c.source}</span>
                {c.externalRef ? ` (${c.externalRef})` : ""}
              </p>
            )}
            {c.decidedAt && c.decidedBy && (
              <p>
                Entschieden: {formatDateTime(c.decidedAt)} von{" "}
                <span className="font-mono">{c.decidedBy}</span>
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* ─── Assessment Empfehlung ─────────────────────────────── */}
          <section className="bg-bg-card rounded-xl border border-border p-5 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-semibold text-text">Assessment</h2>
              <form action={runAssessmentAction}>
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-card border border-border text-text rounded-lg text-xs hover:bg-bg-secondary"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Neu prüfen
                </button>
              </form>
            </div>

            {!assessment ? (
              <p className="text-sm text-text-light">
                Noch keine Prüfung ausgeführt. Klicke auf &ldquo;Neu prüfen&rdquo;.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <RecommendationPill rec={c.recommendation ?? null} />
                  <ScoreBadge score={c.score} />
                  {assessment.runAt && (
                    <span className="text-xs text-text-light">
                      Letzter Check: {formatDateTime(new Date(assessment.runAt))}
                    </span>
                  )}
                </div>

                <ul className="text-sm text-text space-y-1 pt-2">
                  {assessment.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-text-light mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>

                {assessment.reputation && (
                  <ReputationBlock data={assessment.reputation} />
                )}

                <details className="pt-2">
                  <summary className="text-xs text-text-light cursor-pointer hover:text-text">
                    Detail-Signale anzeigen
                  </summary>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <CheckBlock title="USt-ID (VIES)" data={assessment.vies} />
                    <CheckBlock title="Adresse (OSM)" data={assessment.geocode} />
                    <CheckBlock title="Email" data={assessment.email} />
                    <CheckBlock title="Gewerbeschein OCR" data={assessment.ocr} />
                    <CheckBlock title="Reputation (OpenAI + Web)" data={assessment.reputation} />
                  </div>
                </details>
              </>
            )}
          </section>

          {/* ─── Erforderliche Dokumente ──────────────────────────── */}
          {assessment && (assessment.requestedDocs?.length ?? 0) > 0 && (
            <RequestedDocsBlock docs={assessment.requestedDocs ?? []} />
          )}

          {/* ─── Decision ─────────────────────────────────────────── */}
          <section className="bg-bg-card rounded-xl border border-border p-5 space-y-3">
            <h2 className="font-semibold text-text">Entscheidung</h2>
            <form action={decideCaseAction} className="space-y-3">
              <input type="hidden" name="id" value={c.id} />
              <input
                type="text"
                name="reason"
                placeholder="Begründung (optional)"
                defaultValue={c.decisionReason ?? ""}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <input
                type="text"
                name="actor"
                placeholder="Bearbeiter (optional)"
                defaultValue={c.decidedBy ?? ""}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  name="decision"
                  value="approved"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-success/10 text-success hover:bg-success/20 border border-success/20"
                >
                  <CheckCircle2 className="w-4 h-4" /> Freigeben
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="more_docs_needed"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200"
                >
                  <Clock className="w-4 h-4" /> Docs nachfordern
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="rejected"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                >
                  <XCircle className="w-4 h-4" /> Ablehnen
                </button>
              </div>
            </form>
          </section>

          {/* ─── Notiz hinzufügen ─────────────────────────────────── */}
          <section className="bg-bg-card rounded-xl border border-border p-5 space-y-3">
            <h2 className="font-semibold text-text">Notiz hinzufügen</h2>
            <form action={addNoteAction} className="space-y-2">
              <input type="hidden" name="id" value={c.id} />
              <textarea
                name="note"
                rows={2}
                placeholder="Telefonat, Rückfrage, ..."
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                required
              />
              <input
                type="text"
                name="actor"
                placeholder="Bearbeiter (optional)"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-light"
                >
                  Notiz speichern
                </button>
              </div>
            </form>
          </section>

          {/* ─── Verlauf ─────────────────────────────────────────── */}
          <section className="bg-bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-text mb-3">Verlauf</h2>
            <ul className="space-y-2">
              {c.events.map((e) => (
                <li key={e.id} className="flex items-start gap-3 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                  <div className="flex-1">
                    <p className="text-text">
                      <span className="font-medium">{eventLabel(e.type)}</span>
                      {e.message && (
                        <>
                          {" — "}
                          <span className="text-text">{e.message}</span>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-text-light">
                      {formatDateTime(e.createdAt)}{" "}
                      {e.actor && <>· von <span className="font-mono">{e.actor}</span></>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ─── Sidebar: Daten ─────────────────────────────────────── */}
        <aside className="space-y-4">
          <section className="bg-bg-card rounded-xl border border-border p-5 space-y-3">
            <h2 className="font-semibold text-text">Ansprechpartner</h2>
            <Datum icon={<User className="w-4 h-4" />}>
              {c.contactFirstName} {c.contactLastName}
            </Datum>
            <Datum icon={<Mail className="w-4 h-4" />} mono>
              <a href={`mailto:${c.email}`} className="text-accent hover:underline">
                {c.email}
              </a>
            </Datum>
            {c.phone && (
              <Datum icon={<Phone className="w-4 h-4" />} mono>
                {c.phone}
              </Datum>
            )}
          </section>

          <section className="bg-bg-card rounded-xl border border-border p-5 space-y-3">
            <h2 className="font-semibold text-text">Firmenanschrift</h2>
            <Datum icon={<MapPin className="w-4 h-4" />}>
              {c.street}
              <br />
              {c.postalCode} {c.city}
              <br />
              {c.country}
            </Datum>
            {!c.shippingSameAsBilling && (
              <>
                <h3 className="text-sm font-medium text-text-light pt-2">Lieferanschrift</h3>
                <Datum icon={<MapPin className="w-4 h-4" />}>
                  {c.shippingStreet}
                  <br />
                  {c.shippingPostalCode} {c.shippingCity}
                  <br />
                  {c.shippingCountry}
                </Datum>
              </>
            )}
          </section>

          <section className="bg-bg-card rounded-xl border border-border p-5 space-y-3">
            <h2 className="font-semibold text-text">Steuer & Gewerbe</h2>
            {c.ustId ? (
              <Datum icon={<Hash className="w-4 h-4" />} mono>
                {c.ustId}
              </Datum>
            ) : (
              <p className="text-sm text-text-light">Keine USt-ID angegeben.</p>
            )}
            {c.gewerbescheinPath ? (
              <Datum icon={<FileText className="w-4 h-4" />}>
                <a
                  href={`/api/cases/${c.id}/gewerbeschein`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline inline-flex items-center gap-1"
                >
                  {c.gewerbescheinFilename ?? "Gewerbeschein"}{" "}
                  <ExternalLink className="w-3 h-3" />
                </a>
                {c.gewerbescheinSizeBytes && (
                  <span className="text-xs text-text-light ml-1">
                    ({(c.gewerbescheinSizeBytes / 1024).toFixed(0)} KB)
                  </span>
                )}
              </Datum>
            ) : (
              <p className="text-sm text-text-light">Kein Gewerbeschein hochgeladen.</p>
            )}
          </section>

          {/* ─── Dokumente nachreichen ──────────────────────────────── */}
          <section className="bg-bg-card rounded-xl border border-border p-5 space-y-3">
            <h2 className="font-semibold text-text">Dokumente nachreichen</h2>
            {c.documents.length > 0 && (
              <ul className="space-y-2 mb-2">
                {c.documents.map((d) => (
                  <li
                    key={d.id}
                    className="border border-border rounded-lg p-2.5 bg-bg-secondary/40 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text">
                          <span className="text-xs text-accent uppercase tracking-wide mr-1">
                            {d.kind}
                          </span>
                        </p>
                        <a
                          href={`/api/cases/${c.id}/documents/${d.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline inline-flex items-center gap-1 text-xs break-all"
                        >
                          {d.filename}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        {d.note && (
                          <p className="text-xs text-text-light mt-1">{d.note}</p>
                        )}
                        <p className="text-[10px] text-text-light mt-0.5">
                          {(d.sizeBytes / 1024).toFixed(0)} KB · {formatDateTime(d.createdAt)}
                          {d.uploadedBy ? ` · ${d.uploadedBy}` : ""}
                        </p>
                      </div>
                      <form action={deleteDocumentAction}>
                        <input type="hidden" name="docId" value={d.id} />
                        <input type="hidden" name="caseId" value={c.id} />
                        <button
                          type="submit"
                          className="text-xs text-text-light hover:text-red-700"
                          title="Entfernen"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <DocUploadForm caseId={c.id} />
          </section>
        </aside>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

type ParsedAssessment = {
  vies?: unknown;
  geocode?: unknown;
  email?: unknown;
  ocr?: unknown;
  reputation?: ReputationData | null;
  signals?: Record<string, unknown>;
  reasons: string[];
  requestedDocs?: RequestedDocData[];
  runAt?: string;
};

type RequestedDocData = {
  kind: string;
  label: string;
  reason: string;
  severity: "blocker" | "recommended";
};

type ReputationData =
  | { ok: false; skipped?: boolean; reason?: string; error?: string }
  | {
      ok: true;
      verdict: "legitimate" | "uncertain" | "suspicious";
      summary: string;
      signals: {
        hasWebsite?: boolean;
        hasReviews?: boolean;
        averageRating?: number;
        positiveSignals: string[];
        redFlags: string[];
      };
      sources: { title: string; url: string }[];
    };

function customerTypeLabel(type: string, sub: string | null): string {
  const subLabels: Record<string, string> = {
    kfz_werkstatt: "Kfz-Werkstatt",
    reifenservice: "Reifenservice",
    karosseriebau: "Karosseriebau",
    onlineshop: "Online-Shop",
    grosshandel: "Großhandel",
    einzelhandel: "Einzelhandel",
  };
  const parent = type === "werkstatt" ? "Werkstatt" : type === "wiederverkaeufer" ? "Wiederverkäufer" : type;
  if (sub && subLabels[sub]) return `${parent} · ${subLabels[sub]}`;
  return parent;
}

function eventLabel(type: string): string {
  switch (type) {
    case "case_created":
      return "Case angelegt";
    case "assessment_started":
      return "Prüfung gestartet";
    case "assessment_completed":
      return "Prüfung abgeschlossen";
    case "decision":
      return "Entscheidung";
    case "document_uploaded":
      return "Dokument hochgeladen";
    case "status_changed":
      return "Status geändert";
    case "note":
      return "Notiz";
    default:
      return type;
  }
}

function formatDateTime(d: Date): string {
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RecommendationPill({ rec }: { rec: string | null }) {
  if (!rec) return null;
  const meta: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    approve: {
      label: "Empfehlung: Freigeben",
      cls: "bg-green-50 text-green-800 border-green-200",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    review: {
      label: "Empfehlung: Manuell prüfen",
      cls: "bg-amber-50 text-amber-900 border-amber-200",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    reject: {
      label: "Empfehlung: Ablehnen",
      cls: "bg-red-50 text-red-800 border-red-200",
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
  };
  const m = meta[rec];
  if (!m) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full border ${m.cls}`}
    >
      {m.icon} {m.label}
    </span>
  );
}

function RequestedDocsBlock({ docs }: { docs: RequestedDocData[] }) {
  const blockers = docs.filter((d) => d.severity === "blocker");
  const recommended = docs.filter((d) => d.severity === "recommended");
  return (
    <section className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-700" />
        <h2 className="font-semibold text-amber-900">Nachzureichende Dokumente</h2>
      </div>
      {blockers.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-2">
            Zwingend erforderlich
          </p>
          <ul className="space-y-2">
            {blockers.map((d, i) => (
              <li key={i} className="bg-white rounded-lg border border-amber-200 p-3">
                <p className="text-sm font-semibold text-text">{d.label}</p>
                <p className="text-xs text-text-light mt-0.5">{d.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {recommended.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-2">
            Empfohlen
          </p>
          <ul className="space-y-2">
            {recommended.map((d, i) => (
              <li key={i} className="bg-white rounded-lg border border-amber-200/60 p-3">
                <p className="text-sm font-medium text-text">{d.label}</p>
                <p className="text-xs text-text-light mt-0.5">{d.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-amber-900/80 pt-1">
        Diese Liste wird automatisch aus den Prüfungs-Signalen abgeleitet. Bei Vorlage der
        Dokumente kannst du das Assessment erneut auslösen (&ldquo;Neu prüfen&rdquo;) oder direkt freigeben.
      </p>
    </section>
  );
}

function ReputationBlock({ data }: { data: ReputationData | null }) {
  if (!data) return null;
  if (!data.ok) {
    return (
      <div className="text-xs text-text-light bg-bg-secondary rounded-lg p-3 border border-border">
        {data.skipped
          ? `Online-Recherche übersprungen — ${data.reason ?? "—"}`
          : `Online-Recherche fehlgeschlagen — ${data.error ?? "—"}`}
      </div>
    );
  }
  const verdictCls =
    data.verdict === "legitimate"
      ? "bg-green-50 border-green-200 text-green-900"
      : data.verdict === "suspicious"
      ? "bg-red-50 border-red-200 text-red-900"
      : "bg-amber-50 border-amber-200 text-amber-900";
  const verdictLabel =
    data.verdict === "legitimate"
      ? "Web-Recherche: seriös"
      : data.verdict === "suspicious"
      ? "Web-Recherche: VERDÄCHTIG"
      : "Web-Recherche: unklar";
  return (
    <div className={`rounded-lg p-3 border text-sm space-y-2 ${verdictCls}`}>
      <p className="font-semibold">{verdictLabel}</p>
      <p>{data.summary}</p>
      {(data.signals.positiveSignals?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold mt-1">Positive Signale</p>
          <ul className="text-xs list-disc ml-4">
            {data.signals.positiveSignals.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {(data.signals.redFlags?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold mt-1">Red Flags</p>
          <ul className="text-xs list-disc ml-4">
            {data.signals.redFlags.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {data.sources.length > 0 && (
        <div className="pt-1">
          <p className="text-xs font-semibold">Quellen</p>
          <ul className="text-xs space-y-0.5">
            {data.sources.map((s, i) => (
              <li key={i}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:no-underline"
                >
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CheckBlock({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-2 border border-border">
      <p className="font-semibold text-text mb-1">{title}</p>
      <pre className="text-[10px] whitespace-pre-wrap break-all text-text-light overflow-hidden max-h-40">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function Datum({
  icon,
  mono,
  children,
}: {
  icon: React.ReactNode;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-text-light mt-0.5 shrink-0">{icon}</span>
      <span className={`text-text ${mono ? "font-mono text-xs" : ""}`}>{children}</span>
    </div>
  );
}

