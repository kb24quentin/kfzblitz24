/**
 * Container-Library — Phase 6
 *
 * Geschäftslogik rund um Paletten / Kartons / Beutel im Wareneingang:
 *
 *   - createContainer(): legt einen neuen Container an, generiert den Code
 *     im Format `PAL-YYYY-NNNNNN` (laufende Zahl pro Jahr) und berechnet
 *     `maxOpenUntil = openedAt + maxAgeDays` (Default 14 Tage).
 *
 *   - linkItemToContainer(): verknüpft ein RetoureItem mit einem
 *     Container. Schreibt ein Event `item_linked_to_container` ins
 *     bestehende RetoureEvent-Log (case-gebunden, deshalb dort sinnvoll
 *     aufgehoben).
 *
 *   - closeContainer(): setzt status=closed + closedAt=now.
 *
 * Event-Strategie (Doku):
 *   Container-eigene Lifecycle-Events (created/closed) wandern NICHT
 *   ins RetoureEvent-Log, weil sie nicht an einen Case gebunden sind —
 *   die Zustände sind über `openedAt` / `closedAt` / `status` der
 *   Container-Row jederzeit nachvollziehbar. Sobald Container-Aktionen
 *   einen konkreten Case berühren (z.B. ein Item draufgelegt oder
 *   abgenommen wird), schreiben wir ein RetoureEvent auf dem Case.
 *
 *   Sollte später ein eigenes Container-Event-Log nötig sein, könnte
 *   eine neue Tabelle `ContainerEvent` ergänzt werden — vorerst YAGNI.
 */

import type { Container, RetoureItem } from "@prisma/client";
import { prisma } from "./db";

/** Standardlaufzeit eines Containers in Tagen (siehe CLAUDE.md §11). */
export const DEFAULT_MAX_AGE_DAYS = 14;

/** Erlaubte Container-Typen. */
export type ContainerType = "palette" | "carton" | "bag";

/** Erlaubte Container-Status-Werte. */
export type ContainerStatus =
  | "open"
  | "closed"
  | "shipped"
  | "received_supplier";

/**
 * Hard-coded Short-Codes für unsere bekannten Supplier. Diese werden
 * als Container-Code-Prefix verwendet (z. B. "IP-042") damit Lager-
 * Mitarbeiter die richtige Palette aus 5 Metern Entfernung erkennen.
 *
 * Reihenfolge der Lookup-Logik in `supplierShortCode()`:
 *   1. Hard-coded Eintrag in dieser Map (Stamm-Lieferanten)
 *   2. Fallback: erste 2 alphanumerischen Zeichen des Supplier-Namens
 *
 * Sobald wir > 5 Lieferanten haben, sollte ein eigenes
 * `Supplier.shortCode`-Field per Migration kommen. YAGNI bis dahin.
 */
const SUPPLIER_SHORT_CODES: Record<string, string> = {
  Interparts: "IP",
  Autopartner: "AP",
  "kfzBlitz24 Retoure (intern)": "KB",
};

/**
 * Liefert den 2-Buchstaben-Code für einen Supplier — bevorzugt aus
 * der Hard-coded-Map, sonst aus den ersten 2 Buchstaben des Namens.
 *
 * Beispiele:
 *   "Interparts"                     → "IP"  (hard-coded)
 *   "Autopartner"                    → "AP"  (hard-coded)
 *   "kfzBlitz24 Retoure (intern)"    → "KB"  (hard-coded)
 *   "BMW Originalteile Großhandel"   → "BM"  (Fallback)
 *   "Osram Automotive"               → "OS"  (Fallback)
 */
function supplierShortCode(name: string): string {
  if (SUPPLIER_SHORT_CODES[name]) return SUPPLIER_SHORT_CODES[name];
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return cleaned.slice(0, 2) || "X";
}

export interface CreateContainerOptions {
  type: ContainerType;
  /**
   * Lieferant, an den dieser Container retourniert wird. Pflicht — der
   * Code-Generator braucht den Supplier-Namen für den 2-Buchstaben-
   * Prefix (siehe `supplierShortCode()`). Pro Supplier eigenes
   * Container-Code-Schema wie "IP-042", "AP-117", "KB-003".
   * Die interne kfzBlitz24-Retoure-Palette läuft hier mit als
   * regulärer Supplier mit Prefix "KB".
   */
  supplierId: string;
  partnerId?: string;
  createdByPda?: string;
  /** Standard 14 Tage — siehe `DEFAULT_MAX_AGE_DAYS`. */
  maxAgeDays?: number;
}

/**
 * Liefert die nächste laufende Nummer für einen Supplier-Prefix.
 *
 * Wir scannen `Container.code` nach Treffern auf `<PREFIX>-…`, ziehen
 * die höchste Nummer und addieren 1. Bei concurrent inserts kann es
 * theoretisch zu einer Race kommen — der UNIQUE-Constraint auf
 * `Container.code` fängt das ab und wir retryen einmal.
 *
 * Wir ignorieren bewusst alte Codes im Format `PAL-XXX-YYYY-NNNNNN`
 * (die per LIKE-Pattern `PREFIX-%-…` nicht matchen würden weil sie
 * mit `PAL` anfangen, nicht mit unserem neuen 2-Buchstaben-Prefix).
 */
async function nextSequenceForPrefix(prefix: string): Promise<number> {
  // Pattern: "IP-001", "IP-002", ... — striktes 2-Letter-Prefix.
  const pattern = `${prefix}-%`;
  const rows = await prisma.$queryRawUnsafe<{ code: string }[]>(
    `SELECT "code" FROM "Container" WHERE "code" LIKE $1`,
    pattern,
  );
  let max = 0;
  for (const r of rows) {
    // Nur Codes im neuen Format "<PREFIX>-<NNN>" zählen. Alte Codes
    // wie "PAL-INTERP-2026-000002" filtern wir hier explizit aus.
    const m = new RegExp(`^${prefix}-(\\d+)$`).exec(r.code);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/** Formatiert eine laufende Nummer auf 3 Stellen mit führenden Nullen. */
function formatSequence(n: number): string {
  return String(n).padStart(3, "0");
}

/**
 * Legt einen neuen Container an.
 *
 * @returns Die persistierte Container-Row.
 */
export async function createContainer(
  opts: CreateContainerOptions,
): Promise<Container> {
  const maxAgeDays = opts.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const openedAt = new Date();
  const maxOpenUntil = new Date(
    openedAt.getTime() + maxAgeDays * 24 * 60 * 60 * 1000,
  );

  // Code-Format ab 2026-05: kurze Supplier-Prefix-Codes wie "IP-042",
  // "AP-117", "KB-003". Aus dem Lager-UX-Brief: "Container Codes müssen
  // kürzer/ besser lesbar sein damit man als Mitarbeiter die korrekte
  // Palette sofort erkennt." Vorgängerformat war PAL-INTERP-2026-000002.
  if (!opts.supplierId) {
    throw new Error(
      "Container-Anlage erfordert supplierId (Container = 1 Lieferant).",
    );
  }
  const supplier = await prisma.supplier.findUnique({
    where: { id: opts.supplierId },
    select: { name: true },
  });
  if (!supplier) {
    throw new Error(`Supplier nicht gefunden: ${opts.supplierId}`);
  }
  const prefix = supplierShortCode(supplier.name);

  // Einmal retryen wenn UNIQUE-Constraint feuert (race mit parallelem
  // Insert). Beim zweiten Treffer geben wir den Fehler durch.
  for (let attempt = 0; attempt < 2; attempt++) {
    const seq = await nextSequenceForPrefix(prefix);
    const code = `${prefix}-${formatSequence(seq)}`;
    try {
      return await prisma.container.create({
        data: {
          code,
          type: opts.type,
          supplierId: opts.supplierId ?? null,
          partnerId: opts.partnerId ?? null,
          status: "open",
          openedAt,
          maxOpenUntil,
          createdByPda: opts.createdByPda ?? null,
        },
      });
    } catch (err: unknown) {
      // P2002 = Unique constraint violation in Prisma
      const code =
        (err as { code?: string } | null)?.code ?? "";
      if (code === "P2002" && attempt === 0) continue;
      throw err;
    }
  }
  // Unreachable wegen `throw` oben, TS will aber einen Return.
  throw new Error("createContainer: konnte keinen freien Code finden");
}

/**
 * Verknüpft ein RetoureItem mit einem Container.
 *
 * Schreibt zusätzlich ein `item_linked_to_container`-Event ins
 * RetoureEvent-Log des zugehörigen Cases, damit die Bewegung in der
 * Timeline auftaucht.
 *
 * @throws wenn das Item oder der Container nicht existiert, oder der
 *   Container nicht im Status "open" ist.
 */
export async function linkItemToContainer(
  itemId: string,
  containerId: string,
  actor: string,
): Promise<RetoureItem> {
  return await prisma.$transaction(async (tx) => {
    const item = await tx.retoureItem.findUnique({ where: { id: itemId } });
    if (!item) throw new Error(`RetoureItem not found: ${itemId}`);

    const container = await tx.container.findUnique({
      where: { id: containerId },
    });
    if (!container) throw new Error(`Container not found: ${containerId}`);
    if (container.status !== "open") {
      throw new Error(
        `Container ${container.code} ist nicht offen (status=${container.status})`,
      );
    }

    // Container muss einen Supplier haben — die PDA-API erzwingt das
    // bereits bei Anlage; alte Container vor der Phase-6-Erweiterung
    // (ohne supplier) lehnen wir hier ab, damit kein Item ohne
    // Distributor-Bindung in Umlauf gerät.
    if (!container.supplierId) {
      throw new Error(
        `Container ${container.code} hat keinen Lieferanten zugeordnet — Item-Linking abgelehnt`,
      );
    }

    // Wenn das Item bereits einen Supplier hat (z. B. vom Vor-Container),
    // muss er matchen — sonst werfen wir, damit kein Mischwarenkartons-
    // Container entsteht. Bei `supplierId === null` (Erstauflage) übernehmen
    // wir den Container-Supplier kommentarlos.
    if (item.supplierId && item.supplierId !== container.supplierId) {
      throw new Error(
        `Supplier-Konflikt: Artikel ist bereits für Lieferant ${item.supplierId} markiert, Container ${container.code} gehört zu ${container.supplierId}`,
      );
    }

    const updated = await tx.retoureItem.update({
      where: { id: itemId },
      data: {
        containerId,
        status: "on_pallet",
        // Supplier vom Container erben (idempotent — entweder identisch
        // oder vorher null).
        supplierId: container.supplierId,
      },
    });

    await tx.retoureEvent.create({
      data: {
        caseId: item.caseId,
        type: "item_linked_to_container",
        message: `Artikel auf Container ${container.code} gelegt`,
        meta: JSON.stringify({
          itemId: item.id,
          containerId: container.id,
          containerCode: container.code,
          supplierId: container.supplierId,
        }),
        actor,
      },
    });

    return updated;
  });
}

/**
 * Schließt einen Container — danach können keine weiteren Items
 * darauf gelegt werden (linkItemToContainer wirft).
 *
 * Idempotent: bei bereits geschlossenem Container wird die Row
 * unverändert zurückgegeben (ohne erneutes closedAt zu überschreiben).
 */
export async function closeContainer(
  containerId: string,
  actor: string,
): Promise<Container> {
  const existing = await prisma.container.findUnique({
    where: { id: containerId },
  });
  if (!existing) throw new Error(`Container not found: ${containerId}`);
  if (existing.status === "closed") return existing;

  return await prisma.container.update({
    where: { id: containerId },
    data: {
      status: "closed",
      closedAt: new Date(),
      // actor in notes verewigen, falls Audit später nötig — knapp halten.
      notes:
        existing.notes && existing.notes.length > 0
          ? `${existing.notes}\nclosed by ${actor}`
          : `closed by ${actor}`,
    },
  });
}
