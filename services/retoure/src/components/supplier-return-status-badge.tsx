import {
  Clock,
  Truck,
  PackageCheck,
  CheckCircle2,
  XCircle,
  CircleDot,
} from "lucide-react";

/**
 * Status-Metadaten für SupplierReturn — eigene Komponente, weil die
 * Status-Werte nicht mit denen eines RetoureCase überlappen.
 *
 * Farb-Mapping gem. Aufgaben-Vorgabe:
 *   vorbereitet         → grau
 *   versandt            → blau
 *   bei_lieferant       → cyan
 *   gutschrift_erhalten → grün
 *   abgelehnt           → rot
 */
export const SUPPLIER_RETURN_STATUS_META: Record<
  string,
  { label: string; bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  vorbereitet: {
    label: "Vorbereitet",
    bg: "bg-gray-100",
    text: "text-gray-700",
    icon: Clock,
  },
  versandt: {
    label: "Versandt",
    bg: "bg-blue-100",
    text: "text-blue-800",
    icon: Truck,
  },
  bei_lieferant: {
    label: "Bei Lieferant",
    bg: "bg-cyan-100",
    text: "text-cyan-800",
    icon: PackageCheck,
  },
  gutschrift_erhalten: {
    label: "Gutschrift",
    bg: "bg-green-100",
    text: "text-green-800",
    icon: CheckCircle2,
  },
  abgelehnt: {
    label: "Abgelehnt",
    bg: "bg-red-100",
    text: "text-red-800",
    icon: XCircle,
  },
};

export function SupplierReturnStatusBadge({
  status,
  size = "md",
}: {
  status: string;
  size?: "sm" | "md";
}) {
  const meta = SUPPLIER_RETURN_STATUS_META[status] ?? {
    label: status,
    bg: "bg-gray-100",
    text: "text-gray-700",
    icon: CircleDot,
  };
  const Icon = meta.icon;
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";
  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <span
      className={`inline-flex items-center gap-1 ${padding} font-semibold rounded-full ${meta.bg} ${meta.text}`}
    >
      <Icon className={iconSize} /> {meta.label}
    </span>
  );
}

export const SUPPLIER_RETURN_STATUSES = [
  "vorbereitet",
  "versandt",
  "bei_lieferant",
  "gutschrift_erhalten",
  "abgelehnt",
] as const;
