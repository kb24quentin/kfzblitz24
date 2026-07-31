-- Anruf-Retry-Logik: pro Reminder tracken wie oft schon versucht wurde und
-- welche Auflösung am Ende erreicht wurde. Bei Anrufen wird bei "nicht
-- erreicht"-Ergebnissen dueDate geschoben und retryCount++, bis das Limit
-- (im Code) erreicht ist oder ein terminales Ergebnis kommt.
ALTER TABLE "Reminder" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reminder" ADD COLUMN "resolution" TEXT;
