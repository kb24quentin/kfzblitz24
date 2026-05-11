/**
 * Assessment-Orchestrator: führt alle Einzel-Checks in Parallel aus,
 * scored das Ergebnis, persistiert in den B2BCase und legt Events an.
 */

import { prisma } from "../db";
import { checkVies } from "./vies";
import { geocodeAddress } from "./geocode";
import { checkEmail } from "./email";
import { extractGewerbeschein, researchCompany } from "./openai";
import { uploadAbsolutePath } from "../upload";
import { computeScore } from "./score";

export type RunAssessmentResult = {
  ok: boolean;
  score: number;
  recommendation: "approve" | "review" | "reject";
  reasons: string[];
};

/**
 * Lädt den Case, fährt die Checks aus, schreibt Score/Empfehlung/Status
 * + Detail-JSON zurück. Idempotent — kann beliebig oft aufgerufen werden
 * (z.B. nach manuellem Dokumenten-Upload).
 */
export async function runAssessment(caseId: string): Promise<RunAssessmentResult> {
  const c = await prisma.b2BCase.findUnique({
    where: { id: caseId },
    include: { documents: { orderBy: { createdAt: "desc" } } },
  });
  if (!c) {
    return { ok: false, score: 0, recommendation: "reject", reasons: ["Case nicht gefunden."] };
  }

  await prisma.b2BCase.update({
    where: { id: caseId },
    data: { status: "assessing" },
  });
  await prisma.b2BCaseEvent.create({
    data: {
      caseId,
      type: "assessment_started",
      actor: "system",
    },
  });

  // Nachgereichte Dokumente einlesen.
  // Wenn ein nachgereichter Gewerbeschein existiert, nimm den für OCR
  // statt des ursprünglich hochgeladenen.
  const supplementalGewerbe = c.documents.find((d) => d.kind === "gewerbeschein");
  const ocrTarget = supplementalGewerbe
    ? {
        path: supplementalGewerbe.path,
        mime: supplementalGewerbe.mimeType,
        hasFile: true as const,
      }
    : c.gewerbescheinPath && c.gewerbescheinMimeType
    ? {
        path: c.gewerbescheinPath,
        mime: c.gewerbescheinMimeType,
        hasFile: true as const,
      }
    : { hasFile: false as const };

  const satisfiedDocKinds = new Set(c.documents.map((d) => d.kind));

  // Parallel rauslaufen — die OpenAI-Calls sind die langsamsten (Vision + web_search)
  const [vies, geocode, ocr, reputation] = await Promise.all([
    c.ustId ? checkVies(c.ustId) : Promise.resolve(null),
    geocodeAddress({
      street: c.street,
      postalCode: c.postalCode,
      city: c.city,
      country: c.country,
    }),
    ocrTarget.hasFile
      ? extractGewerbeschein(
          uploadAbsolutePath(ocrTarget.path),
          ocrTarget.mime,
          {
            companyName: c.companyName,
            street: c.street,
            postalCode: c.postalCode,
            city: c.city,
          }
        )
      : Promise.resolve(null),
    researchCompany({
      companyName: c.companyName,
      street: c.street,
      postalCode: c.postalCode,
      city: c.city,
      customerType: c.customerType,
    }),
  ]);
  const email = checkEmail(c.email);

  const breakdown = computeScore({
    vies,
    geocode,
    email,
    hasGewerbeschein: !!c.gewerbescheinPath || satisfiedDocKinds.has("gewerbeschein"),
    hasPhone: !!c.phone,
    companyName: c.companyName,
    customerType: c.customerType,
    businessSubtype: c.businessSubtype,
    ocr,
    reputation,
    satisfiedDocKinds,
  });

  // Automatische Status-Setzung (kann durch manuelle Entscheidung
  // später überschrieben werden)
  const autoStatus =
    breakdown.recommendation === "approve"
      ? "approved"
      : breakdown.recommendation === "reject"
      ? "rejected"
      : "more_docs_needed";

  await prisma.b2BCase.update({
    where: { id: caseId },
    data: {
      score: breakdown.score,
      recommendation: breakdown.recommendation,
      assessmentJson: JSON.stringify(
        {
          vies,
          geocode,
          email,
          ocr,
          reputation,
          signals: breakdown.signals,
          reasons: breakdown.reasons,
          requestedDocs: breakdown.requestedDocs,
          runAt: new Date().toISOString(),
        },
        null,
        2
      ),
      // Nur Status ändern, wenn noch nicht manuell entschieden
      status: c.decision ? c.status : autoStatus,
    },
  });

  await prisma.b2BCaseEvent.create({
    data: {
      caseId,
      type: "assessment_completed",
      message: `Score ${breakdown.score}/100 — Empfehlung: ${breakdown.recommendation}`,
      detailsJson: JSON.stringify({
        score: breakdown.score,
        recommendation: breakdown.recommendation,
        reasons: breakdown.reasons,
      }),
      actor: "system",
    },
  });

  return {
    ok: true,
    score: breakdown.score,
    recommendation: breakdown.recommendation,
    reasons: breakdown.reasons,
  };
}
