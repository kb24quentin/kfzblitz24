/**
 * GET /api/pda/suppliers
 *
 * Listet die aktiven Lieferanten (z. B. Interparts, Autopartner) für
 * den Supplier-Picker bei der Container-Anlage im PDA-Frontend.
 *
 * Nur `active=true` Suppliers werden zurückgegeben — inaktive sollen
 * nicht mehr für neue Container ausgewählt werden können.
 *
 * Sortierung: alphabetisch nach Name (Interparts und Autopartner sind
 * der primäre Use-Case; alle anderen folgen nach Name-Reihenfolge).
 */

import { NextResponse } from "next/server";
import { checkPdaAuth } from "@/lib/pda-auth";
import { listActiveSuppliers } from "@/lib/suppliers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await checkPdaAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.status === 503 ? "API_TOKEN nicht konfiguriert" : "Unauthorized",
      },
      { status: auth.status },
    );
  }

  const suppliers = await listActiveSuppliers();
  return NextResponse.json({
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      country: s.country,
    })),
  });
}
