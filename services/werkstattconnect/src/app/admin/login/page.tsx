import Link from "next/link";
import { AdminLoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-black tracking-tight">
              <span className="text-slate-900">W</span>
              <span className="text-orange-600">C</span>
              <span className="hidden sm:inline text-slate-300 mx-2">|</span>
              <span className="hidden sm:inline text-slate-900">
                Werkstatt<span className="text-orange-600">Connect</span>
              </span>
            </span>
          </Link>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900 mb-1">KB24-Admin-Login</h1>
          <p className="text-sm text-slate-500 mb-5">
            Nur für kfzBlitz24-Mitarbeiter — Google-SSO mit @kfzblitz24.de-Account.
          </p>
          <AdminLoginForm />
        </div>
        <p className="text-xs text-slate-500 text-center mt-6">
          <Link href="/login" className="text-orange-600 hover:underline">
            Zurück zum Werkstatt-Login
          </Link>
        </p>
      </div>
    </div>
  );
}
