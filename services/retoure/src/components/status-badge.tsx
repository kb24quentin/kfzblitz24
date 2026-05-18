import {
  Clock,
  Truck,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Ban,
  CircleDot,
  AlertCircle,
} from "lucide-react";

export const STATUS_META: Record<
  string,
  { label: string; bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  angemeldet: {
    label: "Angemeldet",
    bg: "bg-blue-100",
    text: "text-blue-800",
    icon: Clock,
  },
  versandt: {
    label: "Versandt",
    bg: "bg-purple-100",
    text: "text-purple-800",
    icon: Truck,
  },
  unterwegs: {
    label: "Unterwegs",
    bg: "bg-amber-100",
    text: "text-amber-800",
    icon: Truck,
  },
  eingang_partner: {
    label: "Eingang Partner",
    bg: "bg-cyan-100",
    text: "text-cyan-800",
    icon: PackageCheck,
  },
  pruefung: {
    label: "In Prüfung",
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    icon: AlertCircle,
  },
  erstattet: {
    label: "Erstattet",
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
  storniert: {
    label: "Storniert",
    bg: "bg-gray-100",
    text: "text-gray-700",
    icon: Ban,
  },
};

export function StatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const meta = STATUS_META[status] ?? {
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

export const STATUSES = [
  "angemeldet",
  "versandt",
  "unterwegs",
  "eingang_partner",
  "pruefung",
  "erstattet",
  "abgelehnt",
  "storniert",
] as const;
