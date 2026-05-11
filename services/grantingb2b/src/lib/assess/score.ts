/**
 * Scoring & Empfehlung. Eingangs sind alle Einzel-Check-Resultate, raus
 * kommt ein Score 0..100 plus Empfehlung (approve | review | reject).
 *
 * Schwellwerte sind bewusst konservativ angesetzt — Automatisch-Approve
 * verlangt sowohl gültige USt-ID als auch eine geocodierbare Adresse.
 */

import type { ViesResult } from "./vies";
import { fuzzyMatch } from "./vies";
import type { GeocodeResult } from "./geocode";
import type { EmailCheck } from "./email";
import type {
  GewerbescheinExtraction,
  ReputationResearch,
} from "./openai";

export type ScoringInput = {
  vies: ViesResult | null;
  geocode: GeocodeResult | null;
  email: EmailCheck;
  hasGewerbeschein: boolean;
  hasPhone: boolean;
  companyName: string;
  customerType: string;
  ocr?: GewerbescheinExtraction | null;
  reputation?: ReputationResearch | null;
};

export type RequestedDoc = {
  kind:
    | "gewerbeschein"
    | "gewerbeschein_clearer"
    | "ust_id_certificate"
    | "handelsregister"
    | "meisterbrief"
    | "firmenbriefbogen"
    | "personalausweis_inhaber"
    | "address_proof"
    | "bank_statement";
  label: string;
  reason: string;
  severity: "blocker" | "recommended";
};

export type ScoreBreakdown = {
  score: number; // 0..100
  recommendation: "approve" | "review" | "reject";
  reasons: string[]; // menschlich lesbare Begründungen
  signals: Record<string, unknown>; // strukturierte Detail-Signale
  requestedDocs: RequestedDoc[]; // welche Dokumente konkret fehlen / nachzureichen sind
};

export function computeScore(input: ScoringInput): ScoreBreakdown {
  const reasons: string[] = [];
  const signals: Record<string, unknown> = {};
  let score = 0;

  // ─── USt-ID (max 40 Punkte) ──────────────────────────────────────────
  if (input.vies?.ok) {
    signals.vies_valid = input.vies.valid;
    if (input.vies.valid) {
      score += 30;
      reasons.push("USt-ID ist bei VIES als gültig registriert.");
      if (input.vies.name) {
        const sim = fuzzyMatch(input.vies.name, input.companyName);
        signals.vies_company_match = sim;
        if (sim >= 0.7) {
          score += 10;
          reasons.push(
            `Firmenname stimmt mit VIES-Eintrag überein (${(sim * 100).toFixed(0)}%).`
          );
        } else if (sim > 0) {
          reasons.push(
            `Firmenname weicht vom VIES-Eintrag ab (${(sim * 100).toFixed(0)}%). VIES: "${input.vies.name}".`
          );
        }
      }
    } else {
      reasons.push("USt-ID bei VIES NICHT als gültig registriert.");
    }
  } else if (input.vies && !input.vies.ok) {
    signals.vies_error = input.vies.error;
    reasons.push(`USt-ID-Prüfung fehlgeschlagen: ${input.vies.error}`);
  } else {
    reasons.push("Keine USt-ID angegeben.");
  }

  // ─── Adresse (max 25 Punkte) ────────────────────────────────────────
  if (input.geocode?.ok) {
    if (input.geocode.found) {
      signals.geocode_match = input.geocode.addressMatchScore;
      const m = input.geocode.addressMatchScore ?? 0;
      if (m >= 0.66) {
        score += 25;
        reasons.push("Adresse vollständig auf OpenStreetMap auffindbar.");
      } else if (m > 0) {
        score += 12;
        reasons.push(
          `Adresse teilweise auffindbar (${(m * 100).toFixed(0)}% Übereinstimmung).`
        );
      } else {
        score += 5;
        reasons.push("Adresse ist geocodierbar, aber Details weichen ab.");
      }
    } else {
      reasons.push("Adresse konnte auf OpenStreetMap nicht gefunden werden.");
    }
  } else if (input.geocode && !input.geocode.ok) {
    signals.geocode_error = input.geocode.error;
    reasons.push(`Adress-Prüfung fehlgeschlagen: ${input.geocode.error}`);
  }

  // ─── Email (max 15 Punkte) ──────────────────────────────────────────
  signals.email = input.email;
  if (input.email.valid) {
    if (input.email.isDisposable) {
      reasons.push("Email ist ein Wegwerf-Postfach. — Risiko.");
    } else if (input.email.isFreemail) {
      score += 5;
      reasons.push(
        `Email-Domain "${input.email.domain}" ist ein Freemail-Anbieter — keine Firmen-Domain.`
      );
    } else {
      score += 15;
      reasons.push(`Email läuft auf eigener Domain (${input.email.domain}).`);
    }
  } else {
    reasons.push("Email-Format ist ungültig.");
  }

  // ─── Gewerbeschein vorhanden (max 5 Punkte für reine Existenz) ──────
  if (input.hasGewerbeschein) {
    score += 5;
    reasons.push("Gewerbeschein wurde hochgeladen.");
    signals.gewerbeschein_uploaded = true;
  } else {
    reasons.push("Kein Gewerbeschein hochgeladen.");
    signals.gewerbeschein_uploaded = false;
  }

  // ─── Gewerbeschein-OCR (max 15 Punkte) ──────────────────────────────
  if (input.ocr) {
    if (input.ocr.ok) {
      signals.ocr_matches = input.ocr.matches;
      signals.ocr_confidence = input.ocr.confidence;
      let ocrPoints = 0;
      const m = input.ocr.matches;
      if ((m.companyName ?? 0) >= 0.7) {
        ocrPoints += 7;
        reasons.push(
          `Gewerbeschein-Firmenname stimmt mit Eingabe überein (${((m.companyName ?? 0) * 100).toFixed(0)}%).`
        );
      } else if ((m.companyName ?? 0) > 0) {
        reasons.push(
          `Firmenname im Gewerbeschein weicht ab (${((m.companyName ?? 0) * 100).toFixed(0)}%).`
        );
      }
      if (m.postalCode === true) {
        ocrPoints += 3;
      }
      if ((m.city ?? 0) >= 0.7) {
        ocrPoints += 3;
      }
      if ((m.street ?? 0) >= 0.6) {
        ocrPoints += 2;
      }
      if (m.postalCode === true && (m.city ?? 0) >= 0.7 && (m.street ?? 0) >= 0.6) {
        reasons.push("Adresse aus Gewerbeschein stimmt vollständig mit Eingabe überein.");
      } else if (
        m.postalCode === true ||
        (m.city ?? 0) >= 0.7 ||
        (m.street ?? 0) >= 0.6
      ) {
        reasons.push("Adresse aus Gewerbeschein stimmt teilweise mit Eingabe überein.");
      } else if (input.ocr.data.street || input.ocr.data.city) {
        reasons.push("Adresse aus Gewerbeschein weicht von Eingabe ab.");
      }
      score += ocrPoints;
    } else if ("skipped" in input.ocr && input.ocr.skipped) {
      reasons.push("Gewerbeschein-OCR übersprungen (kein OPENAI_API_KEY).");
    } else if ("error" in input.ocr) {
      signals.ocr_error = input.ocr.error;
      reasons.push(`Gewerbeschein-OCR fehlgeschlagen: ${input.ocr.error}`);
    }
  }

  // ─── Telefon (max 5 Punkte) ─────────────────────────────────────────
  if (input.hasPhone) {
    score += 5;
    reasons.push("Telefonnummer angegeben.");
  } else {
    reasons.push("Keine Telefonnummer angegeben.");
  }

  // ─── Reputation / Online-Präsenz (max 10 Punkte) ────────────────────
  if (input.reputation) {
    if (input.reputation.ok) {
      signals.reputation = {
        verdict: input.reputation.verdict,
        summary: input.reputation.summary,
        sources: input.reputation.sources,
      };
      if (input.reputation.verdict === "legitimate") {
        score += 10;
        reasons.push(`Reputations-Check positiv: ${input.reputation.summary}`);
      } else if (input.reputation.verdict === "uncertain") {
        score += 3;
        reasons.push(`Reputations-Check unklar: ${input.reputation.summary}`);
      } else {
        // suspicious → Punktabzug
        score -= 10;
        reasons.push(`⚠ Reputations-Check verdächtig: ${input.reputation.summary}`);
      }
    } else if ("skipped" in input.reputation && input.reputation.skipped) {
      reasons.push("Reputations-Check übersprungen (kein OPENAI_API_KEY).");
    } else if ("error" in input.reputation) {
      signals.reputation_error = input.reputation.error;
      reasons.push(`Reputations-Check fehlgeschlagen: ${input.reputation.error}`);
    }
  }

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  // ─── Requested documents (zuerst, damit die Recommendation sie nutzen kann) ──
  const requestedDocs = computeRequestedDocs(input);

  // ─── Recommendation ─────────────────────────────────────────────────
  let recommendation: ScoreBreakdown["recommendation"];
  if (score >= 80) recommendation = "approve";
  else if (score >= 50) recommendation = "review";
  else recommendation = "reject";

  // Soft-Escalation: Wenn die Engine konkret Dokumente einfordert und der
  // Score nicht katastrophal ist, lieber "review/more_docs_needed" statt
  // direkt ablehnen — der Kunde hat eine echte Chance zu liefern.
  const hasBlockerDocs = requestedDocs.some((d) => d.severity === "blocker");
  if (hasBlockerDocs && score >= 30 && recommendation === "reject") {
    recommendation = "review";
    reasons.push(
      "Empfehlung zu 'Dokumente nachfordern' eskaliert — siehe Doku-Anforderungen."
    );
  }

  return { score, recommendation, reasons, signals, requestedDocs };
}

function isLikelyIncorporated(companyName: string): boolean {
  return /\b(gmbh|ag|ug|kg|ohg|kgaa|se|e\.?k\.?|haftungsbeschr)/i.test(companyName);
}

function computeRequestedDocs(input: ScoringInput): RequestedDoc[] {
  const docs: RequestedDoc[] = [];

  // Gewerbeschein
  if (!input.hasGewerbeschein) {
    docs.push({
      kind: "gewerbeschein",
      label: "Gewerbeschein (Gewerbeanmeldung)",
      reason: "Es wurde kein Gewerbeschein hochgeladen.",
      severity: "blocker",
    });
  } else if (input.ocr && input.ocr.ok) {
    const m = input.ocr.matches;
    const nameOff = (m.companyName ?? 0) < 0.6;
    const addressOff =
      m.postalCode !== true &&
      (m.city ?? 0) < 0.6 &&
      (m.street ?? 0) < 0.6 &&
      (input.ocr.data.street || input.ocr.data.city);
    if (nameOff || addressOff) {
      docs.push({
        kind: "gewerbeschein_clearer",
        label: "Aktueller / besser lesbarer Gewerbeschein",
        reason: nameOff
          ? `Firmenname im hochgeladenen Gewerbeschein weicht von der Eingabe ab${input.ocr.data.companyName ? ` (Dokument: "${input.ocr.data.companyName}")` : ""}.`
          : "Adresse im hochgeladenen Gewerbeschein weicht von der Eingabe ab.",
        severity: "blocker",
      });
    }
    if ((input.ocr.confidence ?? 0) < 0.5) {
      docs.push({
        kind: "gewerbeschein_clearer",
        label: "Gewerbeschein in besserer Qualität / Auflösung",
        reason: "Der hochgeladene Gewerbeschein war schwer lesbar.",
        severity: "recommended",
      });
    }
  }

  // USt-ID-Bescheinigung
  const incorporated = isLikelyIncorporated(input.companyName);
  if (incorporated) {
    if (!input.vies) {
      // keine USt-ID angegeben
      docs.push({
        kind: "ust_id_certificate",
        label: "USt-Identifikationsnummer-Bescheinigung (vom Finanzamt)",
        reason: "Für Kapital-/Personengesellschaften erforderlich; bisher keine USt-ID angegeben.",
        severity: "blocker",
      });
    } else if (input.vies.ok && !input.vies.valid) {
      docs.push({
        kind: "ust_id_certificate",
        label: "Aktuelle USt-ID-Bescheinigung (Finanzamt)",
        reason: "Die angegebene USt-ID konnte bei VIES nicht als gültig bestätigt werden.",
        severity: "blocker",
      });
    } else if (!input.vies.ok) {
      // VIES erreichbar nicht — soft hinweisen
      docs.push({
        kind: "ust_id_certificate",
        label: "USt-ID-Bescheinigung (zur Absicherung)",
        reason: "USt-ID konnte automatisch nicht verifiziert werden (VIES nicht erreichbar).",
        severity: "recommended",
      });
    }

    docs.push({
      kind: "handelsregister",
      label: "Aktueller Handelsregisterauszug (HRB / HRA, nicht älter als 3 Monate)",
      reason: "Bei Kapital-/Personengesellschaft Standard für B2B-Onboarding.",
      severity: "recommended",
    });
  }

  // Werkstatt-spezifisch: Meisterbrief / HWK-Eintrag
  if (
    input.customerType === "werkstatt" &&
    (input.businessSubtype === "kfz_werkstatt" || input.businessSubtype === "karosseriebau")
  ) {
    docs.push({
      kind: "meisterbrief",
      label: "Meisterbrief oder Eintragung in die Handwerksrolle",
      reason: "Kfz-Werkstatt / Karosseriebau gehört zum zulassungspflichtigen Handwerk.",
      severity: "recommended",
    });
  }

  // Freemail → Firmen-Briefbogen
  if (input.email.valid && input.email.isFreemail) {
    docs.push({
      kind: "firmenbriefbogen",
      label: "Firmen-Briefbogen mit Stempel / Visitenkarte",
      reason: `Ansprech-Email läuft auf Freemail-Anbieter (${input.email.domain}). Wir brauchen einen Nachweis der Firmenzugehörigkeit.`,
      severity: "blocker",
    });
  }

  // Adresse nicht auffindbar
  if (input.geocode?.ok && !input.geocode.found) {
    docs.push({
      kind: "address_proof",
      label: "Nachweis der Firmenanschrift (Mietvertrag / aktuelle Versorgerrechnung)",
      reason: "Die angegebene Firmenanschrift konnte online nicht verifiziert werden.",
      severity: "blocker",
    });
  }

  // Suspicious bei Reputation → harter Beleg-Schub
  if (input.reputation?.ok && input.reputation.verdict === "suspicious") {
    docs.push({
      kind: "bank_statement",
      label: "Kontoauszug / Bestätigung der Firmen-Bankverbindung",
      reason: "Online-Recherche zeigte Warnhinweise — bitte Identität zusätzlich belegen.",
      severity: "blocker",
    });
    docs.push({
      kind: "personalausweis_inhaber",
      label: "Personalausweis-Kopie des Inhabers / Geschäftsführers",
      reason: "Zusätzliche Identitätsprüfung erforderlich.",
      severity: "blocker",
    });
  }

  // De-duplizieren (gleiche kind nur einmal, severity blocker gewinnt)
  const seen = new Map<string, RequestedDoc>();
  for (const d of docs) {
    const prev = seen.get(d.kind);
    if (!prev || (prev.severity === "recommended" && d.severity === "blocker")) {
      seen.set(d.kind, d);
    }
  }
  return Array.from(seen.values());
}
