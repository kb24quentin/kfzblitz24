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
 * Mapping Container-Typ → Code-Prefix.
 *
 * Bleibt für alle Typen bewusst auf "PAL" um die im PDF-Designguide
 * vorgesehene Doc-ID `PAL-KB24` zu spiegeln. Wenn später eigene
 * Lauf-Nummernkreise pro Typ gewünscht sind, ist `nextSequenceForYear`
 * der Punkt zum Aufdröseln.
 */
const CODE_PREFIX: Record<ContainerType, string> = {
  palette: "PAL",
  carton: "PAL",
  bag: "PAL",
};

export interface CreateContainerOptions {
  type: ContainerType;
  partnerId?: string;
  createdByPda?: string;
  /** Standard 14 Tage — siehe `DEFAULT_MAX_AGE_DAYS`. */
  maxAgeDays?: number;
}

/**
 * Liefert die nächste laufende Nummer für ein gegebenes Jahr.
 *
 * Wir scannen `Container.code` nach Treffern auf `PAL-{year}-…`, ziehen
 * die höchste Nummer und addieren 1. Bei concurrent inserts kann es
 * theoretisch zu einer Race kommen — der UNIQUE-Constraint auf
 * `Container.code` fängt das ab und wir retryen einmal.
 */
async function nextSequenceForYear(year: number): Promise<number> {
  const pattern = `${CODE_PREFIX.palette}-${year}-%`;
  const rows = await prisma.$queryRawUnsafe<{ code: string }[]>(
    `SELECT "code" FROM "Container" WHERE "code" LIKE $1`,
    pattern,
  );
  let max = 0;
  for (const r of rows) {
    const m = /-(\d+)$/.exec(r.code);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/** Formatiert eine laufende Nummer auf 6 Stellen mit führenden Nullen. */
function formatSequence(n: number): string {
  return String(n).padStart(6, "0");
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
  const year = openedAt.getFullYear();
  const prefix = CODE_PREFIX[opts.type];

  // Einmal retryen wenn UNIQUE-Constraint feuert (race mit parallelem
  // Insert). Beim zweiten Treffer geben wir den Fehler durch.
  for (let attempt = 0; attempt < 2; attempt++) {
    const seq = await nextSequenceForYear(year);
    const code = `${prefix}-${year}-${formatSequence(seq)}`;
    try {
      return await prisma.container.create({
        data: {
          code,
          type: opts.type,
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

    const updated = await tx.retoureItem.update({
      where: { id: itemId },
      data: {
        containerId,
        status: "on_pallet",
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
