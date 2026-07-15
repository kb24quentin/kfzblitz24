-- Konsolidiere 'resolved' + 'closed' → nur noch 'closed'.
-- In der Praxis kein Unterschied zwischen beiden, verwirrt agents mehr
-- als es hilft. resolvedAt-column bleibt (semantik: "wann geschlossen").
UPDATE "Ticket" SET "status" = 'closed' WHERE "status" = 'resolved';
