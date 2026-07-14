import { auth } from "@/lib/auth";

export async function Header() {
  const session = await auth();
  const name = session?.user?.name || session?.user?.email || "";

  return (
    <header className="h-14 border-b border-border bg-bg-card flex items-center justify-end px-6">
      <div className="text-sm text-text-light">
        Angemeldet als <span className="font-medium text-text">{name}</span>
      </div>
    </header>
  );
}
