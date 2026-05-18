"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, AlertCircle, Eye, EyeOff } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/admin";

  const onSubmit = async (e: React.FormEvent) => {
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
        router.push(from);
        router.refresh();
      }
    } catch {
      setError("Ein Fehler ist aufgetreten");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-[#0b3756] mb-1">Email</label>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2.5 border border-[#e6e8eb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40"
          placeholder="name@kfzblitz24.de"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#0b3756] mb-1">Passwort</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 pr-10 border border-[#e6e8eb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6600]/40"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-[#8a93a0] hover:text-[#0b3756]"
            aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#ff6600] text-white rounded-lg text-sm font-semibold hover:bg-[#ff7a26] transition-colors disabled:opacity-50"
      >
        <LogIn className="w-4 h-4" />
        {loading ? "Wird angemeldet..." : "Anmelden"}
      </button>
    </form>
  );
}
