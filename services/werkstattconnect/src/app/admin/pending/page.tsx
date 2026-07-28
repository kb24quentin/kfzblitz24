import Link from "next/link";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AdminPendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-orange-600" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Freigabe erforderlich</h1>
        <p className="text-sm text-slate-600 mb-6">
          Du hast dich erfolgreich mit deinem Google-Account angemeldet. Ein bestehender
          KB24-Admin muss dir jetzt noch WerkstattConnect-Admin-Rechte geben.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition"
        >
          Zurück zur Startseite
        </Link>
      </div>
    </div>
  );
}
