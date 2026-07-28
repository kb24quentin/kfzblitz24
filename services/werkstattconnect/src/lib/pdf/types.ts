import type { InvoicePosition } from "../money";

export type DocKind = "invoice" | "quote";

export type PdfDoc = {
  kind: DocKind;
  number: string; // rechnungs- oder angebots-nummer
  title: string; // "Rechnung" | "Angebot" (i18n später)
  issuedAt: Date;
  dueAt: Date | null; // fällig / gültig-bis
  positions: InvoicePosition[];
  subtotalNetCent: number;
  totalVatCent: number;
  totalGrossCent: number;
  notes: string | null;
  mileageAtIssue: number | null;
  creatorName: string | null;
  paymentMethod: string | null; // 'bank_transfer'|'cash'|'card'|'sepa'|null (nur bei invoice)
  paidAt: Date | null;
  customer: {
    type: string;
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    street: string | null;
    zip: string | null;
    city: string | null;
  };
  vehicle: {
    brand: string | null;
    model: string | null;
    licensePlate: string | null;
    vin: string | null;
    mileage: number | null;
    nextTuev?: Date | null;
    nextInspection?: Date | null;
    firstRegistration?: Date | null;
    hsn?: string | null;
    tsn?: string | null;
  } | null;
  workshop: {
    name: string;
    street: string | null;
    zip: string | null;
    city: string | null;
    contactEmail: string;
    contactPhone: string | null;
    taxId: string | null;
    iban: string | null;
    bic: string | null;
    bankName: string | null;
    brandPrimary: string | null;
    brandAccent: string | null;
    brandFooterText: string | null;
    footerCol1: string | null;
    footerCol2: string | null;
    footerCol3: string | null;
    letterheadLogo: Uint8Array | null;
    letterheadLogoMime: string | null;
    letterheadTemplate: string;
    brandFontFamily: string; // 'helvetica' | 'times' | 'courier'
    brandTableStyle: string; // 'colored' | 'bordered' | 'zebra' | 'minimal'
    brandDensity: string; // 'compact' | 'normal' | 'spacious'
    showCreatorOnDocs: boolean;
    showAwFootnote: boolean;
    hourlyRateCent: number; // für AW-fußnote-berechnung
  };
};

export type TemplateDef = {
  key: string;
  label: string;
  category: "Modern" | "Klassisch" | "Minimal" | "Bold" | "Farbig";
  description: string;
};

export const TEMPLATES: TemplateDef[] = [
  { key: "modern-orange", label: "Modern Orange", category: "Modern", description: "Sauber, Adressblock links" },
  { key: "modern-blue", label: "Modern Blau", category: "Modern", description: "Wie Modern Orange, aber blau" },
  { key: "modern-black", label: "Modern Schwarz", category: "Modern", description: "Elegant monochrom" },
  { key: "modern-green", label: "Modern Grün", category: "Modern", description: "Frisch, öko-feeling" },
  { key: "classic-serif", label: "Klassisch Serif", category: "Klassisch", description: "Traditionell, Times-anmutung" },
  { key: "classic-lines", label: "Klassisch mit Linien", category: "Klassisch", description: "Klare Linien, ruhige Typo" },
  { key: "letterhead-classic", label: "Klassischer Briefkopf", category: "Klassisch", description: "Zentraler Header, formell" },
  { key: "executive", label: "Executive", category: "Klassisch", description: "Elegant mit dünnen Linien" },
  { key: "minimal-thin", label: "Minimal Dünn", category: "Minimal", description: "Sehr reduziert, dünne Linien" },
  { key: "minimal-mono", label: "Minimal Mono", category: "Minimal", description: "Monospace, technisch" },
  { key: "compact-dense", label: "Kompakt dicht", category: "Minimal", description: "Viel Platz für viele Positionen" },
  { key: "bold-band", label: "Bold Farbband", category: "Bold", description: "Farbband voll durch oben" },
  { key: "bold-sidebar", label: "Bold Sidebar", category: "Bold", description: "Sidebar links mit Kontakt" },
  { key: "bold-centered", label: "Bold Zentriert", category: "Bold", description: "Zentrierter Header, big number" },
  { key: "stripe-left", label: "Balken Links", category: "Bold", description: "Durchgehender Balken links (voll)" },
  { key: "stripe-right", label: "Balken Rechts", category: "Bold", description: "Durchgehender Balken rechts" },
  { key: "double-stripe", label: "Doppel-Balken", category: "Bold", description: "Zwei Balken links, dick + dünn" },
  { key: "industrial", label: "Industrial", category: "Bold", description: "Bold Nummer, grosse Typo" },
  { key: "farbig-corners", label: "Farbige Ecken", category: "Farbig", description: "Farb-Ecken oben/unten" },
  { key: "farbig-gradient", label: "Verlauf Header", category: "Farbig", description: "Gradient-Header" },
  { key: "farbig-frame", label: "Farbiger Rahmen", category: "Farbig", description: "Dünner Rahmen um Seite" },
  { key: "farbig-split", label: "Zweifarbig geteilt", category: "Farbig", description: "Oberer Bereich getönt" },
  { key: "corner-triangle", label: "Dreieck-Ecke", category: "Farbig", description: "Grosses Dreieck oben-links" },
  { key: "wave-header", label: "Wellen-Header", category: "Farbig", description: "Geschwungene Trennlinie" },
  { key: "gradient-sidebar", label: "Gradient-Sidebar", category: "Farbig", description: "Verlauf-Sidebar links" },
  { key: "fresh-accents", label: "Frische Akzente", category: "Farbig", description: "Farb-Chips über die Seite" },
  { key: "workshop-tools", label: "Werkstatt-Tools", category: "Modern", description: "Werkzeug-Icon-Akzent" },
  { key: "elegant-margins", label: "Elegant weite Ränder", category: "Klassisch", description: "Grosse Ränder, ruhig" },
];
