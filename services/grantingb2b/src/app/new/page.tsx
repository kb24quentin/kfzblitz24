import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CaseForm } from "./case-form";

export default function NewCasePage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">Neuer B2B-Case</h1>
          <p className="text-sm text-text-light">
            Daten erfassen, Gewerbeschein hochladen — die Engine prüft automatisch und gibt eine
            Empfehlung.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-text-light hover:text-text"
        >
          <ArrowLeft className="w-4 h-4" /> Zurück
        </Link>
      </div>

      <CaseForm />
    </div>
  );
}
