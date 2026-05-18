/**
 * Inventory-Aggregation für das Admin-Dashboard.
 *
 * "Wo ist welche Ware aktuell?" — fasst Items über Case-Status,
 * Container-Status und SupplierReturn-Status zusammen.
 *
 * Stati-Mapping:
 *   Lokation                                | Bedingung
 *   ----------------------------------------+-----------------------------------
 *   im_versand                              | Case in (angemeldet, versandt, unterwegs), Item.status ∈ (pending)
 *   eingang_partner_offen                   | Case.partnerReceivedAt != null && Item nicht auf Container & Item nicht erstattet/abgelehnt
 *   auf_palette_offen                       | Item.containerId mit Container.status = open
 *   palette_geschlossen                     | Item.containerId mit Container.status = closed (vor Versand zum Lieferanten)
 *   unterwegs_zum_lieferanten               | SupplierReturn.status = versandt
 *   beim_lieferanten                        | SupplierReturn.status = bei_lieferant
 *   erstattet                               | SupplierReturn.status = gutschrift_erhalten ODER Item.status = refunded
 *   abgelehnt                               | Item.status = rejected
 */

import { prisma } from "./db";

export interface InventorySummaryBucket {
  key: string;
  label: string;
  itemCount: number;
  /** Summe der Warenwerte (gesamtpreis_brutto). NULL/0 wenn Items keinen Preis haben. */
  warenwertBrutto: number;
  /** Summe der einkaufspreis_brutto (falls gepflegt), sonst null. */
  ekWertBrutto: number | null;
}

export async function getInventorySummary(): Promise<InventorySummaryBucket[]> {
  const items = await prisma.retoureItem.findMany({
    select: {
      id: true,
      status: true,
      caseId: true,
      containerId: true,
      gesamtpreis_brutto: true,
      einkaufspreis_brutto: true,
      case: {
        select: { status: true, partnerReceivedAt: true },
      },
      container: { select: { status: true } },
    },
  });

  // Fetch all open SupplierReturns to map containerId → supplier-return-status
  const supplierReturns = await prisma.supplierReturn.findMany({
    where: { containerId: { not: null } },
    select: { containerId: true, status: true },
  });
  const srByContainer = new Map<string, string>();
  for (const sr of supplierReturns) {
    if (sr.containerId) srByContainer.set(sr.containerId, sr.status);
  }

  const buckets: Record<string, InventorySummaryBucket> = {
    im_versand: { key: "im_versand", label: "Auf dem Weg zu uns", itemCount: 0, warenwertBrutto: 0, ekWertBrutto: 0 },
    eingang_partner_offen: { key: "eingang_partner_offen", label: "Eingang beim Partner — noch unsortiert", itemCount: 0, warenwertBrutto: 0, ekWertBrutto: 0 },
    auf_palette_offen: { key: "auf_palette_offen", label: "Auf offenen Paletten", itemCount: 0, warenwertBrutto: 0, ekWertBrutto: 0 },
    palette_geschlossen: { key: "palette_geschlossen", label: "Palette geschlossen, noch nicht versandt", itemCount: 0, warenwertBrutto: 0, ekWertBrutto: 0 },
    unterwegs_zum_lieferanten: { key: "unterwegs_zum_lieferanten", label: "Unterwegs zum Lieferanten", itemCount: 0, warenwertBrutto: 0, ekWertBrutto: 0 },
    beim_lieferanten: { key: "beim_lieferanten", label: "Beim Lieferanten", itemCount: 0, warenwertBrutto: 0, ekWertBrutto: 0 },
    erstattet: { key: "erstattet", label: "Erstattet / Gutschrift erhalten", itemCount: 0, warenwertBrutto: 0, ekWertBrutto: 0 },
    abgelehnt: { key: "abgelehnt", label: "Abgelehnt", itemCount: 0, warenwertBrutto: 0, ekWertBrutto: 0 },
  };

  let anyEkSet = false;

  for (const it of items) {
    const price = it.gesamtpreis_brutto ?? 0;
    const ek = it.einkaufspreis_brutto ?? 0;
    if (it.einkaufspreis_brutto !== null) anyEkSet = true;

    // Classification
    let bucketKey: keyof typeof buckets;

    if (it.status === "refunded") {
      bucketKey = "erstattet";
    } else if (it.status === "rejected") {
      bucketKey = "abgelehnt";
    } else if (it.containerId && it.container) {
      const sr = srByContainer.get(it.containerId);
      if (sr === "gutschrift_erhalten") {
        bucketKey = "erstattet";
      } else if (sr === "abgelehnt") {
        bucketKey = "abgelehnt";
      } else if (sr === "bei_lieferant") {
        bucketKey = "beim_lieferanten";
      } else if (sr === "versandt") {
        bucketKey = "unterwegs_zum_lieferanten";
      } else if (it.container.status === "closed") {
        bucketKey = "palette_geschlossen";
      } else if (it.container.status === "open") {
        bucketKey = "auf_palette_offen";
      } else {
        bucketKey = "auf_palette_offen"; // fallback
      }
    } else if (it.case.partnerReceivedAt) {
      bucketKey = "eingang_partner_offen";
    } else {
      bucketKey = "im_versand";
    }

    buckets[bucketKey].itemCount += 1;
    buckets[bucketKey].warenwertBrutto += price;
    buckets[bucketKey].ekWertBrutto = (buckets[bucketKey].ekWertBrutto ?? 0) + ek;
  }

  const result = Object.values(buckets);
  // Wenn überall ek=0 ist (keiner gepflegt), null-out
  if (!anyEkSet) {
    for (const b of result) b.ekWertBrutto = null;
  }
  return result;
}

/**
 * Wo ist Artikel X? — Suche über Artikelnummer.
 */
export async function findItemsByArtikelnummer(artikelnummer: string) {
  return prisma.retoureItem.findMany({
    where: {
      artikelnummer: { contains: artikelnummer.trim(), mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      case: {
        select: {
          id: true,
          bestellnummer: true,
          customerName: true,
          customerVorname: true,
        },
      },
      container: { select: { id: true, code: true, status: true } },
    },
  });
}
