// Konstanten + Types, die zwischen Server-Action und Client-Komponenten
// geteilt werden. Muss eine EIGENE Datei sein, weil "use server"-Files
// in Next.js nur async functions exportieren dürfen.

// Nach wie vielen "nicht erreicht"-Versuchen geben wir auf.
export const MAX_CALL_RETRIES = 5;

export type CallOutcome =
  | "reached"          // erfolgreich gesprochen — done
  | "voicemail"        // Mailbox erreicht — retry
  | "wrong_number"     // falsche Nummer — retry, aber User sollte Nummer korrigieren
  | "not_reached"      // niemand dran, kein AB — retry
  | "not_interested"   // gesprochen aber Absage — done
  | "appointment";     // Termin vereinbart — done

export const OUTCOMES_THAT_RETRY: CallOutcome[] = ["voicemail", "wrong_number", "not_reached"];
export const OUTCOMES_THAT_FINISH: CallOutcome[] = ["reached", "not_interested", "appointment"];

export type LogCallInput = {
  reminderId: string;
  outcome: CallOutcome;
  notes: string;
  newContactStatus?: string | null;
};

export type LogCallResult = {
  ok: boolean;
  message: string;
  retryScheduledFor?: Date;
};
