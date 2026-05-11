type Status = "pending" | "assessing" | "approved" | "rejected" | "more_docs_needed" | string;

const META: Record<string, { label: string; cls: string }> = {
  pending: {
    label: "Neu",
    cls: "bg-bg-secondary text-text-light border-border",
  },
  assessing: {
    label: "Wird geprüft",
    cls: "bg-blue-50 text-blue-800 border-blue-200",
  },
  approved: {
    label: "Freigegeben",
    cls: "bg-green-50 text-green-800 border-green-200",
  },
  rejected: {
    label: "Abgelehnt",
    cls: "bg-red-50 text-red-800 border-red-200",
  },
  more_docs_needed: {
    label: "Docs nachgefordert",
    cls: "bg-amber-50 text-amber-900 border-amber-200",
  },
};

export function StatusBadge({ status }: { status: Status }) {
  const m = META[status] ?? { label: status, cls: "bg-bg-secondary text-text border-border" };
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border bg-bg-secondary text-text-light border-border">
        — / 100
      </span>
    );
  }
  const cls =
    score >= 80
      ? "bg-green-50 text-green-800 border-green-200"
      : score >= 50
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : "bg-red-50 text-red-800 border-red-200";
  return (
    <span
      className={`inline-flex items-center text-xs font-mono font-semibold px-2 py-0.5 rounded-full border ${cls}`}
    >
      {score} / 100
    </span>
  );
}
