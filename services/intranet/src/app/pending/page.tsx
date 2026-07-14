import Link from "next/link";
import { Clock, Mail } from "lucide-react";

export const dynamic = "force-dynamic";

export default function PendingPage() {
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/kfzblitz-logo.svg"
            alt="kfzblitz24"
            className="h-12 w-auto mx-auto"
          />
          <p className="text-white/60 text-sm mt-3">Support</p>
        </div>

        <div className="bg-bg-card rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7 text-warning" />
          </div>
          <h2 className="text-lg font-bold text-text mb-2">
            Zugriff wartet auf Freigabe
          </h2>
          <p className="text-sm text-text-light mb-6 leading-relaxed">
            Dein Google-Account wurde registriert, aber ein Admin muss deinen
            Zugang noch aktivieren. Sobald das erfolgt ist, kannst du dich
            einloggen.
          </p>

          <div className="p-3 bg-info/5 border border-info/20 rounded-lg text-xs text-text-light mb-6 text-left">
            <div className="flex items-start gap-2">
              <Mail className="w-4 h-4 text-info shrink-0 mt-0.5" />
              <div>
                Frag kurz bei einem Kollegen mit Admin-Rechten nach —
                z.B. per Slack oder <span className="font-medium">Quentin</span>.
                Der Admin sieht deinen Account bereits in den Einstellungen und
                kann dich mit einem Klick aktivieren.
              </div>
            </div>
          </div>

          <Link
            href="/login"
            className="inline-block px-4 py-2 border border-border rounded-lg text-sm text-text-light hover:bg-bg-secondary transition-colors"
          >
            Zurück zum Login
          </Link>
        </div>
      </div>
    </div>
  );
}
