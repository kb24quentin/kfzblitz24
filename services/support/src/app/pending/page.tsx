import Link from "next/link";
import { Clock } from "lucide-react";

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
          <h2 className="text-lg font-bold text-text mb-2">Wird geprüft</h2>
          <p className="text-sm text-text-light mb-6 leading-relaxed">
            Ein Admin wurde informiert und schaltet dich in Kürze frei.
          </p>

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
