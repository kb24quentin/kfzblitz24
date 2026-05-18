import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0b3756] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-3xl font-bold tracking-tight">
            <span className="text-white">kfz</span>
            <span className="text-[#ff6600]">blitz</span>
            <span className="text-white">24</span>
          </p>
          <p className="text-white/60 text-sm mt-2">Retouren-Dashboard</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-[#0b3756] mb-1">Anmelden</h2>
          <p className="text-sm text-[#8a93a0] mb-6">
            Login fürs Retouren-Admin
          </p>
          <Suspense fallback={<div className="text-sm text-[#8a93a0]">Lädt…</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
