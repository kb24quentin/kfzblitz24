import Link from "next/link";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function WorkshopLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <img
              src="/werkstattconnect-logo.svg"
              alt="WerkstattConnect"
              className="h-12 w-auto mx-auto"
            />
          </Link>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900 mb-1">Werkstatt-Login</h1>
          <p className="text-sm text-slate-500 mb-5">
            Melde dich mit deinen Werkstatt-Zugangsdaten an.
          </p>
          <LoginForm />
        </div>
        <p className="text-xs text-slate-500 text-center mt-6">
          Noch kein Zugang?{" "}
          <a
            href="mailto:info@kfzblitz24.de?subject=WerkstattConnect%20Zugang%20anfragen"
            className="text-orange-600 hover:underline"
          >
            Zugang anfragen
          </a>
        </p>
      </div>
    </div>
  );
}
