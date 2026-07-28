export type CatalogItem = {
  category: string;
  name: string;
  description?: string;
  laborHours: number;
  /**
   * Typische Ersatzteile für diese Leistung — werden beim Auswählen als
   * Teil-Positionen vorgeschlagen (mit 0€ preis, den Werkstatt-User setzt).
   * Später ersetzt durch echte kfzBlitz24-Artikel-suche.
   */
  suggestedParts?: string[];
};

/**
 * Standard-Katalog für Kfz-Werkstätten. laborHours sind realistische AW-werte
 * (arbeitswerte, 1 AW = 6 min = 0.1 std). Preis = laborHours × workshop.hourlyRate.
 * Teilepreise NICHT enthalten — die kommen separat als eigene position.
 */
export const STANDARD_CATALOG: CatalogItem[] = [
  // ---------- Wartung ----------
  { category: "Wartung", name: "Ölwechsel mit Filter", description: "Motoröl ablassen, Filter tauschen, neu befüllen", laborHours: 0.5, suggestedParts: ["Motoröl (5L)", "Ölfilter", "Ölablassschraube-Dichtring"] },
  { category: "Wartung", name: "Große Inspektion", description: "Herstellervorgabe, alle Betriebsflüssigkeiten prüfen", laborHours: 3.0 },
  { category: "Wartung", name: "Kleine Inspektion", description: "Sichtkontrolle, Öl-/Flüssigkeitsstände", laborHours: 1.5 },
  { category: "Wartung", name: "Innenraumfilter tauschen", laborHours: 0.4, suggestedParts: ["Innenraumfilter (Aktivkohle)"] },
  { category: "Wartung", name: "Luftfilter tauschen", laborHours: 0.3, suggestedParts: ["Luftfilter"] },
  { category: "Wartung", name: "Kraftstofffilter tauschen (Diesel)", laborHours: 0.8, suggestedParts: ["Kraftstofffilter Diesel"] },
  { category: "Wartung", name: "Zündkerzen tauschen (4-Zyl.)", laborHours: 0.6, suggestedParts: ["Zündkerzen-Satz (4 Stk)"] },
  { category: "Wartung", name: "Keilrippenriemen tauschen", laborHours: 1.2, suggestedParts: ["Keilrippenriemen"] },
  { category: "Wartung", name: "Zahnriemen tauschen (mit Wasserpumpe)", laborHours: 4.5, suggestedParts: ["Zahnriemen-Kit (mit Rollen)", "Wasserpumpe", "Kühlflüssigkeit (5L)"] },
  { category: "Wartung", name: "Steuerkette tauschen", laborHours: 6.0, suggestedParts: ["Steuerketten-Satz", "Motoröl (5L)", "Ölfilter"] },

  // ---------- Bremsen ----------
  { category: "Bremsen", name: "Bremsbeläge vorne tauschen", laborHours: 0.8, suggestedParts: ["Bremsbelag-Satz vorne"] },
  { category: "Bremsen", name: "Bremsbeläge hinten tauschen", laborHours: 0.8, suggestedParts: ["Bremsbelag-Satz hinten"] },
  { category: "Bremsen", name: "Bremsscheiben + Beläge vorne", laborHours: 1.2, suggestedParts: ["Bremsscheiben vorne (Paar)", "Bremsbelag-Satz vorne", "Verschleißanzeige vorne"] },
  { category: "Bremsen", name: "Bremsscheiben + Beläge hinten", laborHours: 1.2, suggestedParts: ["Bremsscheiben hinten (Paar)", "Bremsbelag-Satz hinten", "Verschleißanzeige hinten"] },
  { category: "Bremsen", name: "Bremsflüssigkeit wechseln", laborHours: 0.7, suggestedParts: ["Bremsflüssigkeit DOT 4 (1L)"] },
  { category: "Bremsen", name: "Bremssattel tauschen", laborHours: 1.5, suggestedParts: ["Bremssattel"] },
  { category: "Bremsen", name: "Bremsleitung erneuern", laborHours: 1.0, suggestedParts: ["Bremsleitung", "Bremsflüssigkeit DOT 4 (1L)"] },
  { category: "Bremsen", name: "Handbremse einstellen", laborHours: 0.4 },
  { category: "Bremsen", name: "ABS-Sensor tauschen", laborHours: 0.6, suggestedParts: ["ABS-Sensor"] },

  // ---------- Reifen ----------
  { category: "Reifen", name: "Räderwechsel (4 Räder)", description: "Sommer/Winter mit vorhandenen Rädern", laborHours: 0.5 },
  { category: "Reifen", name: "Reifen montieren + wuchten (4 Stk)", laborHours: 1.0, suggestedParts: ["Wuchtgewichte-Satz", "Ventil-Kit (4 Stk)"] },
  { category: "Reifen", name: "Achsvermessung + Einstellung", laborHours: 1.2 },
  { category: "Reifen", name: "Reifen einlagern (Saison)", laborHours: 0.3 },
  { category: "Reifen", name: "Reifendrucksensor RDKS anlernen", laborHours: 0.5, suggestedParts: ["RDKS-Sensor"] },
  { category: "Reifen", name: "Reifenreparatur (Pilzstopfen)", laborHours: 0.5, suggestedParts: ["Reifen-Reparaturpilz"] },

  // ---------- Motor ----------
  { category: "Motor", name: "Motordiagnose OBD auslesen", laborHours: 0.5 },
  { category: "Motor", name: "AGR-Ventil reinigen/tauschen", laborHours: 2.0, suggestedParts: ["AGR-Ventil", "AGR-Dichtung"] },
  { category: "Motor", name: "Turbolader tauschen", laborHours: 5.0, suggestedParts: ["Turbolader", "Ölleitung Turbo", "Motoröl (5L)"] },
  { category: "Motor", name: "Wasserpumpe tauschen (ohne Zahnriemen)", laborHours: 2.5, suggestedParts: ["Wasserpumpe", "Kühlflüssigkeit (5L)"] },
  { category: "Motor", name: "Thermostat tauschen", laborHours: 1.2, suggestedParts: ["Thermostat", "Kühlflüssigkeit (5L)"] },
  { category: "Motor", name: "Kühlflüssigkeit wechseln + entlüften", laborHours: 0.8, suggestedParts: ["Kühlflüssigkeit (5L)"] },
  { category: "Motor", name: "Kupplung tauschen (FWD)", laborHours: 6.0, suggestedParts: ["Kupplungssatz (Scheibe+Druckplatte+Ausrücklager)", "Getriebeöl"] },
  { category: "Motor", name: "Auspuff Endschalldämpfer tauschen", laborHours: 0.8, suggestedParts: ["Endschalldämpfer", "Auspuff-Dichtung"] },

  // ---------- Fahrwerk ----------
  { category: "Fahrwerk", name: "Stoßdämpfer vorne (Paar)", laborHours: 2.0, suggestedParts: ["Stoßdämpfer vorne (Paar)", "Domlager-Satz vorne"] },
  { category: "Fahrwerk", name: "Stoßdämpfer hinten (Paar)", laborHours: 1.5, suggestedParts: ["Stoßdämpfer hinten (Paar)"] },
  { category: "Fahrwerk", name: "Federn tauschen (vorne, Paar)", laborHours: 2.5, suggestedParts: ["Fahrwerksfedern vorne (Paar)"] },
  { category: "Fahrwerk", name: "Spurstangenkopf tauschen", laborHours: 0.8, suggestedParts: ["Spurstangenkopf"] },
  { category: "Fahrwerk", name: "Querlenker tauschen", laborHours: 1.5, suggestedParts: ["Querlenker", "Querlenker-Buchsen"] },
  { category: "Fahrwerk", name: "Radlager tauschen", laborHours: 1.2, suggestedParts: ["Radlager-Satz"] },
  { category: "Fahrwerk", name: "Antriebswelle tauschen", laborHours: 2.0, suggestedParts: ["Antriebswelle", "Achsmutter"] },

  // ---------- Elektrik ----------
  { category: "Elektrik", name: "Batterie tauschen + anlernen", laborHours: 0.5, suggestedParts: ["Autobatterie (nach Größe)"] },
  { category: "Elektrik", name: "Lichtmaschine tauschen", laborHours: 2.0, suggestedParts: ["Lichtmaschine", "Keilrippenriemen"] },
  { category: "Elektrik", name: "Anlasser tauschen", laborHours: 1.5, suggestedParts: ["Anlasser"] },
  { category: "Elektrik", name: "Fehlerspeicher löschen + Adaption", laborHours: 0.4 },
  { category: "Elektrik", name: "Software-Update (herstellerspezifisch)", laborHours: 1.0 },
  { category: "Elektrik", name: "Scheinwerferlampe tauschen (H7/LED)", laborHours: 0.4, suggestedParts: ["Leuchtmittel H7/LED"] },

  // ---------- Klima ----------
  { category: "Klima", name: "Klimaanlage Service (Wartung)", description: "Kältemittel prüfen, ergänzen, Filter", laborHours: 0.8, suggestedParts: ["Kältemittel R1234yf/R134a", "Klima-Öl"] },
  { category: "Klima", name: "Klimaanlage komplett neu befüllen", laborHours: 1.2, suggestedParts: ["Kältemittel R1234yf/R134a (500g)", "Klima-Öl"] },
  { category: "Klima", name: "Klimakompressor tauschen", laborHours: 3.5, suggestedParts: ["Klimakompressor", "Trockner", "Klima-Öl", "Kältemittel"] },
  { category: "Klima", name: "Trockner tauschen", laborHours: 1.0, suggestedParts: ["Trockner", "Kältemittel"] },

  // ---------- HU/AU ----------
  { category: "HU/AU", name: "HU (TÜV) Vorführung", description: "Anmeldung, Präsentation, Bericht", laborHours: 0.7 },
  { category: "HU/AU", name: "AU (Abgasuntersuchung)", laborHours: 0.4 },
  { category: "HU/AU", name: "HU-Nachprüfung", laborHours: 0.4 },

  // ---------- Sonstiges ----------
  { category: "Sonstiges", name: "Fehlersuche Elektrik (Stundenweise)", laborHours: 1.0 },
  { category: "Sonstiges", name: "Karosserie-Arbeit (Stundenweise)", laborHours: 1.0 },
  { category: "Sonstiges", name: "Fahrzeugwäsche innen+außen", laborHours: 0.5 },
];
