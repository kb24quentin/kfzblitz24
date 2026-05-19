"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Sekunden-genauer Countdown bis zur Pairing-Code-Expiry.
 * Wenn die Zeit abläuft, refresht die Page automatisch — das Server-
 * Component-Render zeigt dann den "Code abgelaufen"-State.
 */
export function PairingCountdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const target = new Date(expiresAt).getTime();
  const secsLeft = Math.max(0, Math.floor((target - now) / 1000));

  useEffect(() => {
    if (secsLeft === 0) {
      router.refresh();
    }
  }, [secsLeft, router]);

  const min = Math.floor(secsLeft / 60);
  const sec = secsLeft % 60;

  const color =
    secsLeft < 60
      ? "text-red-700"
      : secsLeft < 180
        ? "text-[#ff6600]"
        : "text-[#0b3756]";

  return (
    <p className={`font-mono font-semibold text-lg mt-0.5 ${color}`}>
      {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
    </p>
  );
}
