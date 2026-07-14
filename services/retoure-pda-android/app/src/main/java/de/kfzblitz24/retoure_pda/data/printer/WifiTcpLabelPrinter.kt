package de.kfzblitz24.retoure_pda.data.printer

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException

/**
 * Schickt TSPL/ZPL-Bytes per TCP an einen WiFi-Etikettendrucker
 * (Xprinter XP-420B, Zebra ZQ mit WiFi, generische Netzdrucker).
 *
 * Protokoll: raw TCP auf Port 9100 (JetDirect). Der Drucker interpretiert
 * die Bytes selbst als seine native Druckersprache.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * XPRINTER XP-420B GOTCHAS (aus Memory printer-xp420b.md):
 *   • Der Drucker antwortet NICHT auf ICMP-Ping — kein Ping-Precheck.
 *   • ALLES auf einmal senden. Kein Chunking mit Pausen. Der ESP-WiFi-Chip
 *     interpretiert Pausen >20ms als Job-Ende und resettet die Verbindung
 *     (ECONNRESET bei ~2% Fortschritt reproduzierbar). Wir schreiben also
 *     einmal `write(bytes)` und lassen den Kernel die Segmentierung machen.
 *   • Standard-Adresse im Warehouse: 192.168.178.66:9100
 * ─────────────────────────────────────────────────────────────────────────
 */
class WifiTcpLabelPrinter {

    companion object {
        private const val TAG = "PdaWifiPrinter"
        /** JetDirect / Raw-TCP Standard-Port für Netzwerk-Drucker. */
        const val DEFAULT_PORT = 9100
    }

    /** Ergebnis-Typ analog zu BluetoothLabelPrinter. */
    sealed class Result {
        data class Ok(val durationMs: Long, val bytesSent: Int) : Result()
        data class Err(val message: String) : Result()
    }

    /**
     * Adresse in PrinterStore wird als "IP" oder "IP:Port" gespeichert.
     * Wenn kein Port angegeben ist, nehmen wir 9100.
     *
     * Beispiele: "192.168.178.66", "192.168.178.66:9100", "10.0.0.42:9101"
     */
    private data class Endpoint(val host: String, val port: Int)

    private fun parseAddress(address: String): Endpoint? {
        val trimmed = address.trim()
        if (trimmed.isEmpty()) return null
        val idx = trimmed.lastIndexOf(':')
        if (idx < 0) return Endpoint(host = trimmed, port = DEFAULT_PORT)
        val host = trimmed.substring(0, idx).trim()
        val portStr = trimmed.substring(idx + 1).trim()
        val port = portStr.toIntOrNull() ?: return null
        if (host.isEmpty() || port !in 1..65535) return null
        return Endpoint(host = host, port = port)
    }

    /**
     * Sendet die kompletten Label-Bytes an den Drucker und schließt die
     * Verbindung. Der Aufruf ist blockierend im IO-Dispatcher.
     *
     * @param address           IP oder IP:Port. Port default 9100.
     * @param labelBody         Kompletter TSPL- oder ZPL-Text.
     * @param connectTimeoutMs  Socket-Connect-Timeout. Xprinter braucht ~1-2s.
     * @param writeTimeoutMs    Wie lange wir maximal auf `write()`-Completion
     *                          warten. 4×6-Label ist üblicherweise <10 KB.
     */
    suspend fun print(
        address: String,
        labelBody: String,
        connectTimeoutMs: Int = 5_000,
        writeTimeoutMs: Int = 10_000,
    ): Result = printBytes(
        address = address,
        bytes = labelBody.toByteArray(Charsets.UTF_8),
        connectTimeoutMs = connectTimeoutMs,
        writeTimeoutMs = writeTimeoutMs,
    )

    /**
     * Wie `print()`, aber nimmt raw ByteArray direkt entgegen. Nötig für
     * TSPL BITMAP-Payloads vom Backend, die Text- und Binary-Daten mixen
     * (SIZE/CLS als ASCII, dann rohe 1bpp Pixel-Bytes, dann PRINT).
     * String-Roundtrip (UTF-8) würde die Binary-Bytes zerstören.
     */
    suspend fun printBytes(
        address: String,
        bytes: ByteArray,
        connectTimeoutMs: Int = 5_000,
        writeTimeoutMs: Int = 10_000,
    ): Result = withContext(Dispatchers.IO) {
        val started = System.currentTimeMillis()

        val ep = parseAddress(address)
            ?: return@withContext Result.Err(
                "Ungültige Drucker-Adresse: '$address'. Format: IP oder IP:Port (z.B. 192.168.178.66)."
            )
        var socket: Socket? = null
        try {
            socket = Socket().apply {
                // TCP_NODELAY damit die Bytes ohne Nagle-Delay rausfliegen —
                // wichtig damit der ESP-WiFi-Chip keine Pausen sieht.
                tcpNoDelay = true
                soTimeout = writeTimeoutMs
            }
            socket.connect(InetSocketAddress(ep.host, ep.port), connectTimeoutMs)

            // KEIN Chunking. Alles auf einmal schreiben. Der TCP-Stack macht
            // die Segmentierung, aber ohne Pausen zwischen den Segmenten —
            // das ist es was der Xprinter braucht.
            socket.getOutputStream().use { out ->
                out.write(bytes)
                out.flush()
            }

            val duration = System.currentTimeMillis() - started
            Log.d(TAG, "Sent ${bytes.size} bytes to ${ep.host}:${ep.port} in ${duration}ms")
            Result.Ok(durationMs = duration, bytesSent = bytes.size)
        } catch (e: SocketTimeoutException) {
            Log.w(TAG, "Connect/write timeout to ${ep.host}:${ep.port}", e)
            Result.Err(
                "Drucker unter ${ep.host}:${ep.port} antwortet nicht. " +
                        "Eingeschaltet? Im gleichen WLAN? IP-Adresse korrekt?"
            )
        } catch (e: IOException) {
            Log.w(TAG, "Print failed to ${ep.host}:${ep.port}", e)
            Result.Err(friendlyIoError(e, ep.host, ep.port))
        } finally {
            try { socket?.close() } catch (_: IOException) { /* ignore */ }
        }
    }

    private fun friendlyIoError(e: IOException, host: String, port: Int): String {
        val msg = e.message?.lowercase() ?: "unbekannter fehler"
        return when {
            "connection refused" in msg ->
                "Drucker $host:$port verweigert Verbindung — läuft der Print-Service? Falscher Port?"
            "no route to host" in msg || "unreachable" in msg ->
                "Drucker $host nicht erreichbar — PDA und Drucker im gleichen WLAN?"
            "econnreset" in msg || "connection reset" in msg ->
                "Drucker $host hat die Verbindung mitten im Druck getrennt. Bei Xprinter-Modellen: keine Chunking-Pausen (Bug in Firmware)."
            "broken pipe" in msg ->
                "Drucker $host hat die Verbindung geschlossen bevor der Job fertig war."
            else ->
                "Netzwerk-Fehler beim Drucken auf $host:$port: ${e.message ?: "unbekannt"}"
        }
    }
}
