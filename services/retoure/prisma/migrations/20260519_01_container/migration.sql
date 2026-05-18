-- ─────────────────────────────────────────────────────────────────────
-- Phase 6: Container / Pallet Workflow
--
-- Neue Tabelle "Container" für Paletten/Kartons/Beutel im Wareneingang.
-- RetoureItem.containerId existiert bereits (Phase 5) — hier nur noch
-- der FK auf Container(id) mit ON DELETE SET NULL, damit beim Löschen
-- eines Containers die Items zurück in den "freien" Pool fallen.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE "Container" (
    "id"                    TEXT NOT NULL,
    "code"                  TEXT NOT NULL,
    "type"                  TEXT NOT NULL DEFAULT 'palette',
    "partnerId"             TEXT,
    "status"                TEXT NOT NULL DEFAULT 'open',
    "openedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt"              TIMESTAMP(3),
    "maxOpenUntil"          TIMESTAMP(3),
    "createdByPda"          TEXT,
    "shippedTrackingNumber" TEXT,
    "notes"                 TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Container_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Container_code_key"       ON "Container"("code");
CREATE        INDEX "Container_status_idx"    ON "Container"("status");
CREATE        INDEX "Container_partnerId_idx" ON "Container"("partnerId");
CREATE        INDEX "Container_openedAt_idx"  ON "Container"("openedAt");

-- FK von RetoureItem.containerId → Container.id, SET NULL bei DELETE
ALTER TABLE "RetoureItem"
  ADD CONSTRAINT "RetoureItem_containerId_fkey"
  FOREIGN KEY ("containerId") REFERENCES "Container"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
