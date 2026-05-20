"use client";

/**
 * Druck-Trigger für Container-Labels.
 *
 * Funktioniert mit der Munbyn-Chrome-Extension:
 *   - User hat die Munbyn-Extension installiert und den USB-Drucker
 *     dort gepairt.
 *   - Wir öffnen das Label-PDF in einem versteckten iframe.
 *   - `iframe.contentWindow.print()` triggert den Print-Flow.
 *   - Die Extension intercepted den Print-Dialog und schickt das PDF
 *     direkt an den gepairten Drucker.
 *
 * Ohne Extension: User sieht den normalen System-Print-Dialog und
 * kann den Drucker manuell wählen. Funktioniert also auch als Fallback.
 *
 * Auto-Print bei Container-Anlage:
 *   `autoOnLoad`-Prop. Bei `true` wird der Druck einmalig kurz nach
 *   Mount ausgelöst — ohne User-Klick. Speichert sich nichts, einfach
 *   one-shot pro Mount.
 */

import { useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";

interface Props {
  containerId: string;
  containerCode: string;
  /** Bei true: druckt automatisch beim Mount (für frisch angelegte Container). */
  autoOnLoad?: boolean;
}

export function PrintContainerButton({
  containerId,
  containerCode,
  autoOnLoad,
}: Props): React.JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [printing, setPrinting] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const triggerPrint = (): void => {
    setPrinting(true);
    setLastMessage(null);

    // Falls schon ein altes iframe existiert, entfernen
    if (iframeRef.current) {
      iframeRef.current.remove();
      iframeRef.current = null;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "210mm";
    iframe.style.height = "297mm";
    iframe.style.border = "none";
    iframe.src = `/api/admin/containers/${containerId}/label-pdf`;

    iframe.onload = () => {
      try {
        const win = iframe.contentWindow;
        if (!win) throw new Error("iframe contentWindow null");
        win.focus();
        win.print();
        setLastMessage(`Druck ausgelöst für ${containerCode}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setLastMessage(`Druck fehlgeschlagen: ${msg}`);
      } finally {
        setPrinting(false);
      }
    };

    iframe.onerror = () => {
      setLastMessage("PDF konnte nicht geladen werden.");
      setPrinting(false);
    };

    document.body.appendChild(iframe);
    iframeRef.current = iframe;
  };

  // Auto-Print bei Mount wenn gewünscht
  useEffect(() => {
    if (autoOnLoad) {
      // kleinen delay damit der React-Tree gerendert ist
      const t = window.setTimeout(triggerPrint, 250);
      return (): void => window.clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOnLoad, containerId]);

  // Cleanup
  useEffect(() => {
    return (): void => {
      if (iframeRef.current) {
        iframeRef.current.remove();
        iframeRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={triggerPrint}
        disabled={printing}
        className="w-full px-3 py-2 bg-[#0b3756] text-white text-sm rounded-lg hover:bg-[#0e3f63] disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        <Printer className="w-4 h-4" />
        {printing ? "Druckt…" : "Label drucken"}
      </button>
      {lastMessage && (
        <p className="text-[10px] text-[#8a93a0]">{lastMessage}</p>
      )}
      <p className="text-[10px] text-[#8a93a0]">
        Über die Munbyn-Chrome-Extension wird das PDF direkt an den
        gepairten USB-Drucker gesendet. Ohne Extension öffnet sich der
        System-Druckdialog.
      </p>
    </div>
  );
}
