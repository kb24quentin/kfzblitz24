"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogIn, AlertCircle, Eye, EyeOff } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email oder Passwort falsch");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Ein Fehler ist aufgetreten");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    await signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loadingGoogle}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-border rounded-lg text-sm font-semibold bg-white hover:bg-bg-secondary transition-colors disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="#4285F4" d="M23.06 12.25c0-.85-.08-1.66-.22-2.44H12v4.62h6.19a5.3 5.3 0 01-2.3 3.48v2.89h3.72c2.17-2 3.44-4.96 3.44-8.55z"/>
          <path fill="#34A853" d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.88c-1.03.69-2.35 1.09-3.9 1.09-3 0-5.55-2.02-6.46-4.75H1.68v2.98A11.98 11.98 0 0012 24z"/>
          <path fill="#FBBC05" d="M5.54 14.67a7.2 7.2 0 010-4.6V7.1H1.68a12 12 0 000 10.55l3.86-2.98z"/>
          <path fill="#EA4335" d="M12 4.75c1.7 0 3.22.58 4.4 1.72l3.3-3.3C17.72 1.2 15.11 0 12 0A11.98 11.98 0 001.68 7.1l3.86 2.98C6.46 6.77 9.01 4.75 12 4.75z"/>
        </svg>
        {loadingGoogle ? "Weiterleiten…" : "Mit Google anmelden"}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-bg-card px-2 text-text-light">oder mit Passwort</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-danger">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-text mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            placeholder="name@kfzblitz24.de"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Passwort</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              placeholder="Passwort eingeben"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              tabIndex={-1}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-text-light hover:text-text transition-colors"
              aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
              title={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
        >
          <LogIn className="w-4 h-4" />
          {loading ? "Wird angemeldet…" : "Anmelden"}
        </button>
      </form>
    </div>
  );
}
