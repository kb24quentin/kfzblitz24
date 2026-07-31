import { auth } from "@/lib/auth";
import { HeaderClient } from "./header-client";

// Server component — reads session server-side so we can greet the user by name.
export async function Header() {
  const session = await auth();
  const name = session?.user?.name || session?.user?.email?.split("@")[0] || "";
  return <HeaderClient userName={name} />;
}
