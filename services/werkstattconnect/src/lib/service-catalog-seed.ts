export type CatalogItem = {
  category: string;
  name: string;
  description?: string;
  laborHours: number;
};

/**
 * Standard-Katalog für Kfz-Werkstätten. laborHours sind realistische AW-werte
 * (arbeitswerte, 1 AW = 6 min = 0.1 std). Preis = laborHours × workshop.hourlyRate.
 * Teilepreise NICHT enthalten — die kommen separat als eigene position.
 */
export const STANDARD_CATALOG: CatalogItem[] = [
  // ---------- Wartung ----------
  { category: "Wartung", name: "Ölwechsel mit Filter", description: "Motoröl ablassen, Filter tauschen, neu befüllen", laborHours: 0.5 },
  { category: "Wartung", name: "Große Inspektion", description: "Herstellervorgabe, alle Betriebsflüssigkeiten prüfen", laborHours: 3.0 },
  { category: "Wartung", name: "Kleine Inspektion", description: "Sichtkontrolle, Öl-/Flüssigkeitsstände", laborHours: 1.5 },
  { category: "Wartung", name: "Innenraumfilter tauschen", laborHours: 0.4 },
  { category: "Wartung", name: "Luftfilter tauschen", laborHours: 0.3 },
  { category: "Wartung", name: "Kraftstofffilter tauschen (Diesel)", laborHours: 0.8 },
  { category: "Wartung", name: "Zündkerzen tauschen (4-Zyl.)", laborHours: 0.6 },
  { category: "Wartung", name: "Keilrippenriemen tauschen", laborHours: 1.2 },
  { category: "Wartung", name: "Zahnriemen tauschen (mit Wasserpumpe)", laborHours: 4.5 },
  { category: "Wartung", name: "Steuerkette tauschen", laborHours: 6.0 },

  // ---------- Bremsen ----------
  { category: "Bremsen", name: "Bremsbeläge vorne tauschen", laborHours: 0.8 },
  { category: "Bremsen", name: "Bremsbeläge hinten tauschen", laborHours: 0.8 },
  { category: "Bremsen", name: "Bremsscheiben + Beläge vorne", laborHours: 1.2 },
  { category: "Bremsen", name: "Bremsscheiben + Beläge hinten", laborHours: 1.2 },
  { category: "Bremsen", name: "Bremsflüssigkeit wechseln", laborHours: 0.7 },
  { category: "Bremsen", name: "Bremssattel tauschen", laborHours: 1.5 },
  { category: "Bremsen", name: "Bremsleitung erneuern", laborHours: 1.0 },
  { category: "Bremsen", name: "Handbremse einstellen", laborHours: 0.4 },
  { category: "Bremsen", name: "ABS-Sensor tauschen", laborHours: 0.6 },

  // ---------- Reifen ----------
  { category: "Reifen", name: "Räderwechsel (4 Räder)", description: "Sommer/Winter mit vorhandenen Rädern", laborHours: 0.5 },
  { category: "Reifen", name: "Reifen montieren + wuchten (4 Stk)", laborHours: 1.0 },
  { category: "Reifen", name: "Achsvermessung + Einstellung", laborHours: 1.2 },
  { category: "Reifen", name: "Reifen einlagern (Saison)", laborHours: 0.3 },
  { category: "Reifen", name: "Reifendrucksensor RDKS anlernen", laborHours: 0.5 },
  { category: "Reifen", name: "Reifenreparatur (Pilzstopfen)", laborHours: 0.5 },

  // ---------- Motor ----------
  { category: "Motor", name: "Motordiagnose OBD auslesen", laborHours: 0.5 },
  { category: "Motor", name: "AGR-Ventil reinigen/tauschen", laborHours: 2.0 },
  { category: "Motor", name: "Turbolader tauschen", laborHours: 5.0 },
  { category: "Motor", name: "Wasserpumpe tauschen (ohne Zahnriemen)", laborHours: 2.5 },
  { category: "Motor", name: "Thermostat tauschen", laborHours: 1.2 },
  { category: "Motor", name: "Kühlflüssigkeit wechseln + entlüften", laborHours: 0.8 },
  { category: "Motor", name: "Kupplung tauschen (FWD)", laborHours: 6.0 },
  { category: "Motor", name: "Auspuff Endschalldämpfer tauschen", laborHours: 0.8 },

  // ---------- Fahrwerk ----------
  { category: "Fahrwerk", name: "Stoßdämpfer vorne (Paar)", laborHours: 2.0 },
  { category: "Fahrwerk", name: "Stoßdämpfer hinten (Paar)", laborHours: 1.5 },
  { category: "Fahrwerk", name: "Federn tauschen (vorne, Paar)", laborHours: 2.5 },
  { category: "Fahrwerk", name: "Spurstangenkopf tauschen", laborHours: 0.8 },
  { category: "Fahrwerk", name: "Querlenker tauschen", laborHours: 1.5 },
  { category: "Fahrwerk", name: "Radlager tauschen", laborHours: 1.2 },
  { category: "Fahrwerk", name: "Antriebswelle tauschen", laborHours: 2.0 },

  // ---------- Elektrik ----------
  { category: "Elektrik", name: "Batterie tauschen + anlernen", laborHours: 0.5 },
  { category: "Elektrik", name: "Lichtmaschine tauschen", laborHours: 2.0 },
  { category: "Elektrik", name: "Anlasser tauschen", laborHours: 1.5 },
  { category: "Elektrik", name: "Fehlerspeicher löschen + Adaption", laborHours: 0.4 },
  { category: "Elektrik", name: "Software-Update (herstellerspezifisch)", laborHours: 1.0 },
  { category: "Elektrik", name: "Scheinwerferlampe tauschen (H7/LED)", laborHours: 0.4 },

  // ---------- Klima ----------
  { category: "Klima", name: "Klimaanlage Service (Wartung)", description: "Kältemittel prüfen, ergänzen, Filter", laborHours: 0.8 },
  { category: "Klima", name: "Klimaanlage komplett neu befüllen", laborHours: 1.2 },
  { category: "Klima", name: "Klimakompressor tauschen", laborHours: 3.5 },
  { category: "Klima", name: "Trockner tauschen", laborHours: 1.0 },

  // ---------- HU/AU ----------
  { category: "HU/AU", name: "HU (TÜV) Vorführung", description: "Anmeldung, Präsentation, Bericht", laborHours: 0.7 },
  { category: "HU/AU", name: "AU (Abgasuntersuchung)", laborHours: 0.4 },
  { category: "HU/AU", name: "HU-Nachprüfung", laborHours: 0.4 },

  // ---------- Sonstiges ----------
  { category: "Sonstiges", name: "Fehlersuche Elektrik (Stundenweise)", laborHours: 1.0 },
  { category: "Sonstiges", name: "Karosserie-Arbeit (Stundenweise)", laborHours: 1.0 },
  { category: "Sonstiges", name: "Fahrzeugwäsche innen+außen", laborHours: 0.5 },
];
