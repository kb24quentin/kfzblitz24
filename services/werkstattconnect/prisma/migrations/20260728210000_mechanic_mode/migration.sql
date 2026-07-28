-- Mechaniker-Modus: Live-tracking + Protokoll + Kunden-Freigabe

ALTER TABLE "Appointment" ADD COLUMN "actualStartedAt"           TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "actualEndedAt"             TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "customerApprovalRequested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN "approvedAmountCent"        INT;
ALTER TABLE "Appointment" ADD COLUMN "approvedAt"                TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "approvalSignatureSvg"      TEXT;

CREATE INDEX "Appointment_workshopId_status_idx" ON "Appointment"("workshopId","status");

CREATE TABLE "AppointmentWorkLog" (
    "id"            TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "createdBy"     TEXT,
    "kind"          TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "quantity"      DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit"          TEXT NOT NULL DEFAULT 'Stk',
    "serviceItemId" TEXT,
    "note"          TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppointmentWorkLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "AppointmentWorkLog" ADD CONSTRAINT "AppointmentWorkLog_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "AppointmentWorkLog_appointmentId_createdAt_idx" ON "AppointmentWorkLog"("appointmentId","createdAt");
