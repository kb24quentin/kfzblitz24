/**
 * Registry of internal apps. Each entry becomes a tile on the intranet
 * landing page and a column in the app-access matrix in team management.
 *
 * `syncApi`: if set, the intranet calls this app's user-provisioning API
 * when an admin grants or revokes access. The app must expose:
 *   POST   {syncApi}/api/internal/users  (Bearer INTERNAL_API_TOKEN)
 *   DELETE {syncApi}/api/internal/users/:email
 */
export type AppRole = {
  key: string;
  label: string;
  description: string;
};

export type AppDef = {
  key: string;
  label: string;
  description: string;
  url: string;
  icon: string;
  color: string;
  roles: AppRole[];
  /** Container-network base URL for cross-service calls (docker service name) */
  syncApi?: string;
};

export const APPS: AppDef[] = [
  {
    key: "support",
    label: "Support",
    description: "Ticket-System & Kunden-Anfragen",
    url: "https://support.kfzblitz24-group.com",
    icon: "Inbox",
    color: "#ff6600",
    syncApi: process.env.SUPPORT_INTERNAL_URL || "http://support:3000",
    roles: [
      {
        key: "agent",
        label: "Agent",
        description:
          "Tickets zugewiesen bekommen, beantworten, Status/Priorität ändern, Notizen schreiben, Templates nutzen. Kann keine Team-Verwaltung oder Systemeinstellungen.",
      },
      {
        key: "admin",
        label: "Admin",
        description:
          "Wie Agent + verwaltet Templates, SLAs, AI-Autopilot, Ticket-Kategorien, Geschäftszeiten. Alles außer Team-Verwaltung (bleibt im Intranet).",
      },
    ],
  },
  {
    key: "retoure_admin",
    label: "Retoure-Admin",
    description: "RMA-Dashboard & Retouren-Verwaltung",
    url: "https://rma.kfzblitz24-group.com",
    icon: "PackageOpen",
    color: "#0b3756",
    roles: [
      {
        key: "agent",
        label: "Agent",
        description:
          "RMA-Cases bearbeiten, Retouren zuordnen, Labels erzeugen, Kunden-Kommunikation im Retouren-Fluss. Auto-Provisioning noch nicht angebunden.",
      },
      {
        key: "admin",
        label: "Admin",
        description:
          "Wie Agent + Systemeinstellungen, Anbindung zu Webisco, Cron-Jobs. Auto-Provisioning noch nicht angebunden.",
      },
    ],
  },
  {
    key: "crm",
    label: "CRM",
    description: "Kontakte, Kampagnen, Cold Outreach",
    url: "https://crm.staging.kfzblitz24-group.com",
    icon: "Users",
    color: "#0e2742",
    roles: [
      {
        key: "user",
        label: "User",
        description:
          "Kontakte anlegen, Kampagnen fahren, Templates nutzen. Auto-Provisioning noch nicht angebunden.",
      },
      {
        key: "admin",
        label: "Admin",
        description:
          "Wie User + Team-Verwaltung, Signaturen, Systemeinstellungen. Auto-Provisioning noch nicht angebunden.",
      },
    ],
  },
  {
    key: "grantingb2b",
    label: "B2B Bonität",
    description: "Bonitäts-Prüfungen für B2B",
    url: "https://grantingb2b.staging.kfzblitz24-group.com",
    icon: "ShieldCheck",
    color: "#3d4654",
    roles: [
      {
        key: "user",
        label: "User",
        description: "Bonitätsanfragen einreichen und Ergebnisse einsehen.",
      },
      {
        key: "admin",
        label: "Admin",
        description:
          "Wie User + Systemeinstellungen, Anbieter-Konfiguration.",
      },
    ],
  },
  {
    key: "opensign",
    label: "OpenSign",
    description: "Dokumente elektronisch unterzeichnen",
    url: "https://opensign.staging.kfzblitz24-group.com",
    icon: "FileSignature",
    color: "#8a93a0",
    roles: [
      {
        key: "user",
        label: "User",
        description: "Dokumente hochladen, senden, signieren lassen.",
      },
      {
        key: "admin",
        label: "Admin",
        description: "Wie User + Team + Template-Verwaltung.",
      },
    ],
  },
  {
    key: "shopware",
    label: "Shop-Backend",
    description: "Shopware Administration",
    url: "https://kfzblitz24.de/admin",
    icon: "Store",
    color: "#189eff",
    roles: [
      {
        key: "user",
        label: "User",
        description:
          "Bestellungen einsehen, Kunden anlegen. Rolle wird nur intern getrackt, Shopware hat eigene Nutzer-Verwaltung.",
      },
      {
        key: "admin",
        label: "Admin",
        description:
          "Voller Backend-Zugriff. Rolle wird nur intern getrackt.",
      },
    ],
  },
];

export type AppKey = string;
