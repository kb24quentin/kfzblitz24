import { auth } from "@/lib/auth";

export async function Header() {
  const session = await auth();
  const name = session?.user?.name || session?.user?.email || "";
  const image = session?.user?.image;

  return (
    <header className="h-14 border-b border-border bg-bg-card flex items-center justify-end px-6">
      <div className="flex items-center gap-3">
        <div className="text-sm text-text-light">
          Angemeldet als <span className="font-medium text-text">{name}</span>
        </div>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
            {name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
}
