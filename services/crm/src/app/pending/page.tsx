import Link from "next/link";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary p-6">
      <div className="max-w-md w-full bg-bg-card border border-border rounded-xl p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-warning" />
        </div>
        <h1 className="text-lg font-semibold text-text mb-2">
          Zugriff angefragt
        </h1>
        <p className="text-sm text-text-light mb-6">
          Du hast dich erfolgreich mit deinem Google-Account angemeldet. Ein
          Admin muss dir jetzt noch im Intranet Zugriff auf das CRM geben —
          das dauert normalerweise nur kurz.
        </p>
        <Link
          href="https://kfzblitz24-group.com"
          className="inline-block px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          Zurück zum Intranet
        </Link>
      </div>
    </div>
  );
}
