/**
 * Registry of internal apps. Each entry becomes a tile on the intranet
 * landing page and a row in the app-access matrix in team management.
 *
 * `roles`: allowed role values when granting access. Individual apps may
 * enforce these however they want — the intranet just persists them.
 */
export const APPS = [
  {
    key: "support",
    label: "Support",
    description: "Ticket-System & Kunden-Anfragen",
    url: "https://support.kfzblitz24-group.com",
    icon: "Inbox",
    color: "#ff6600",
    roles: ["agent", "admin"],
  },
  {
    key: "retoure_admin",
    label: "Retoure-Admin",
    description: "RMA-Dashboard & Retouren-Verwaltung",
    url: "https://rma.kfzblitz24-group.com",
    icon: "PackageOpen",
    color: "#0b3756",
    roles: ["agent", "admin"],
  },
  {
    key: "crm",
    label: "CRM",
    description: "Kontakte, Kampagnen, Cold Outreach",
    url: "https://crm.staging.kfzblitz24-group.com",
    icon: "Users",
    color: "#0e2742",
    roles: ["user", "admin"],
  },
  {
    key: "grantingb2b",
    label: "B2B Bonität",
    description: "Bonitäts-Prüfungen für B2B",
    url: "https://grantingb2b.staging.kfzblitz24-group.com",
    icon: "ShieldCheck",
    color: "#3d4654",
    roles: ["user", "admin"],
  },
  {
    key: "opensign",
    label: "OpenSign",
    description: "Dokumente elektronisch unterzeichnen",
    url: "https://opensign.staging.kfzblitz24-group.com",
    icon: "FileSignature",
    color: "#8a93a0",
    roles: ["user", "admin"],
  },
  {
    key: "shopware",
    label: "Shop-Backend",
    description: "Shopware Administration",
    url: "https://kfzblitz24.de/admin",
    icon: "Store",
    color: "#189eff",
    roles: ["user", "admin"],
  },
] as const;

export type AppKey = (typeof APPS)[number]["key"];
export type AppDef = (typeof APPS)[number];
