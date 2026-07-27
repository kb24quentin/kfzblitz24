"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    await signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border rounded-lg text-sm font-semibold bg-white hover:bg-bg-secondary transition-colors disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="#4285F4" d="M23.06 12.25c0-.85-.08-1.66-.22-2.44H12v4.62h6.19a5.3 5.3 0 01-2.3 3.48v2.89h3.72c2.17-2 3.44-4.96 3.44-8.55z"/>
          <path fill="#34A853" d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.88c-1.03.69-2.35 1.09-3.9 1.09-3 0-5.55-2.02-6.46-4.75H1.68v2.98A11.98 11.98 0 0012 24z"/>
          <path fill="#FBBC05" d="M5.54 14.67a7.2 7.2 0 010-4.6V7.1H1.68a12 12 0 000 10.55l3.86-2.98z"/>
          <path fill="#EA4335" d="M12 4.75c1.7 0 3.22.58 4.4 1.72l3.3-3.3C17.72 1.2 15.11 0 12 0A11.98 11.98 0 001.68 7.1l3.86 2.98C6.46 6.77 9.01 4.75 12 4.75z"/>
        </svg>
        {loading ? "Weiterleiten…" : "Mit Google anmelden"}
      </button>
      <p className="text-xs text-text-light text-center">
        Nur mit @kfzblitz24.de-Konto möglich.
      </p>
    </div>
  );
}
