import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            kfz<span className="text-accent">blitz</span>24
          </h1>
          <p className="text-white/60 text-sm mt-1">CRM Acquirer</p>
        </div>

        {/* Login Card */}
        <div className="bg-bg-card rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-text mb-1">Anmelden</h2>
          <p className="text-sm text-text-light mb-6">
            Melde dich an um auf das CRM zuzugreifen
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
