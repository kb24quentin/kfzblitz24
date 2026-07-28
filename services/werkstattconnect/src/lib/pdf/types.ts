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
  };
};

export type TemplateDef = {
  key: string;
  label: string;
  category: "Modern" | "Klassisch" | "Minimal" | "Bold" | "Farbig";
  description: string;
};

export const TEMPLATES: TemplateDef[] = [
  { key: "modern-orange", label: "Modern Orange", category: "Modern", description: "Sauber, orange akzent, adressblock links" },
  { key: "modern-blue", label: "Modern Blau", category: "Modern", description: "Wie Modern Orange, aber blau" },
  { key: "modern-black", label: "Modern Schwarz", category: "Modern", description: "Elegant monochrom" },
  { key: "modern-green", label: "Modern Grün", category: "Modern", description: "Frisch, öko-feeling" },
  { key: "classic-serif", label: "Klassisch Serif", category: "Klassisch", description: "Traditionell, Times-anmutung" },
  { key: "classic-lines", label: "Klassisch mit Linien", category: "Klassisch", description: "Klare Linien, ruhige Typo" },
  { key: "minimal-thin", label: "Minimal Dünn", category: "Minimal", description: "Sehr reduziert, dünne linien" },
  { key: "minimal-mono", label: "Minimal Mono", category: "Minimal", description: "Monospace-touch, technisch" },
  { key: "bold-band", label: "Bold Farbband", category: "Bold", description: "Farbiges Header-Band voll durch" },
  { key: "bold-sidebar", label: "Bold Sidebar", category: "Bold", description: "Farbige Sidebar links mit Kontakt" },
  { key: "bold-centered", label: "Bold Zentriert", category: "Bold", description: "Zentrierter Header, big number" },
  { key: "farbig-corners", label: "Farbige Ecken", category: "Farbig", description: "Farbige eckakzente" },
  { key: "farbig-gradient", label: "Verlauf Header", category: "Farbig", description: "Gradient-header oben" },
  { key: "farbig-frame", label: "Farbiger Rahmen", category: "Farbig", description: "Dünner farbrahmen um seite" },
  { key: "farbig-split", label: "Zweifarbig geteilt", category: "Farbig", description: "Oberer teil primär, unterer akzent" },
  { key: "workshop-tools", label: "Werkstatt-Tools", category: "Modern", description: "Mit Werkzeug-icon-akzent" },
  { key: "compact-dense", label: "Kompakt dicht", category: "Minimal", description: "Viel platz für viele positionen" },
  { key: "elegant-margins", label: "Elegant weite Ränder", category: "Klassisch", description: "Grosse ränder, ruhig" },
];
