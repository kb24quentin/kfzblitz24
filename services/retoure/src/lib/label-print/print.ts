/**
 * Raw TCP ZPL sender.
 *
 * Zebra-compatible label printers expose a raw socket on port 9100
 * (JetDirect-style). We just open a TCP socket, write the ZPL byte
 * stream and close. No protocol negotiation, no acknowledgement.
 *
 * Intentionally side-effect-free: this module never logs. Callers
 * decide what to do with success/failure (e.g. event log, RMA case
 * audit trail).
 */

import { Socket } from "node:net";

/** Outcome of a print attempt. Discriminated union — branch on `ok`. */
export type PrintResult =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

/** Default JetDirect raw-print port. */
export const DEFAULT_PRINTER_PORT = 9100;

/** Default network timeout in ms — connection + write must complete inside this. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Sends a ZPL document to a Zebra-compatible network printer over raw TCP.
 *
 * @param zpl   Complete ZPL document (must already contain `^XA…^XZ`).
 * @param host  IP/hostname of the printer.
 * @param port  TCP port (default 9100).
 * @param timeoutMs Connect + write timeout (default 10s).
 *
 * @returns Promise resolving to a discriminated union — never rejects.
 *
 * @example
 *   const r = await sendZplToPrinter(zpl, "192.168.10.42");
 *   if (!r.ok) { ... }
 */
export function sendZplToPrinter(
  zpl: string,
  host: string,
  port: number = DEFAULT_PRINTER_PORT,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<PrintResult> {
  return new Promise<PrintResult>((resolve) => {
    const started = Date.now();
    const socket = new Socket();
    let settled = false;

    const settle = (result: PrintResult): void => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore — socket may already be closed.
      }
      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.once("timeout", () => {
      settle({ ok: false, error: `Printer ${host}:${port} timed out after ${timeoutMs}ms` });
    });

    socket.once("error", (err: NodeJS.ErrnoException) => {
      const code = err.code ?? "ERR";
      let msg: string;
      switch (code) {
        case "ECONNREFUSED":
          msg = `Connection refused by ${host}:${port} (printer offline or wrong port?)`;
          break;
        case "ECONNRESET":
          msg = `Connection reset by ${host}:${port} (printer dropped the link mid-stream)`;
          break;
        case "EHOSTUNREACH":
          msg = `Host ${host} unreachable from this network`;
          break;
        case "ENETUNREACH":
          msg = `Network to ${host} unreachable`;
          break;
        case "ETIMEDOUT":
          msg = `Connection to ${host}:${port} timed out`;
          break;
        default:
          msg = `Socket error (${code}): ${err.message}`;
      }
      settle({ ok: false, error: msg });
    });

    socket.connect(port, host, () => {
      // ZPL printers expect plain bytes ending the stream is a no-op;
      // they just print whatever is between ^XA and ^XZ. We end() to
      // close cleanly once write has flushed.
      socket.end(zpl, "utf8", () => {
        settle({ ok: true, durationMs: Date.now() - started });
      });
    });
  });
}
