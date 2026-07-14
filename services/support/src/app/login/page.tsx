import { LoginForm } from "./login-form";

export default function LoginPage() {
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

        <div className="bg-bg-card rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-text mb-1">Anmelden</h2>
          <p className="text-sm text-text-light mb-6">
            Melde dich an um auf das Support-System zuzugreifen
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
