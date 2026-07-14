package de.kfzblitz24.retoure_pda.data.printer

import de.kfzblitz24.retoure_pda.data.api.RetoureApi
import de.kfzblitz24.retoure_pda.data.api.friendlyMessage

/**
 * Orchestrator für den Druck-Flow:
 *
 *   1. Fetch ZPL vom Backend (Auth via OkHttp-Interceptor)
 *   2. Default-Drucker aus PrinterStore lesen
 *   3. Je nach Transport an BluetoothLabelPrinter oder (später) den
 *      WiFi-Printer-Service delegieren.
 *
 * Liefert ein einheitliches Result-Objekt zurück mit User-freundlicher
 * Fehlermeldung — keine Exceptions nach außen.
 */
class PrinterRepository(
    private val api: RetoureApi,
    private val printerStore: PrinterStore,
    private val bluetoothPrinter: BluetoothLabelPrinter,
    private val wifiPrinter: WifiTcpLabelPrinter,
) {

    sealed class PrintOutcome {
        data class Ok(val printerName: String, val durationMs: Long) : PrintOutcome()
        /** Kein Drucker konfiguriert — UI soll den Settings-Screen öffnen. */
        object NoPrinterConfigured : PrintOutcome()
        data class Err(val message: String) : PrintOutcome()
    }

    /**
     * Schickt einen Diagnose-Druck "TEST kfzBlitz24" an den gespeicherten
     * Drucker. Nutzt den `?test=hello`-Param des Endpoints — kein
     * Container-Lookup. Wenn DAS druckt, weiss man:
     *   - Bluetooth-Transport ok
     *   - Druckersprache passt (TSPL bzw. ZPL je nach Setting)
     *   - Nur das Pallet-Layout könnte noch Probleme machen
     * Wenn NICHT druckt, ist die Wahl der Druckersprache wahrscheinlich
     * falsch — User soll TSPL/ZPL im Settings-Screen umschalten.
     *
     * Wir benutzen eine Dummy-Container-ID — der Test-Modus checkt sie
     * nicht.
     */
    suspend fun printTestLabel(): PrintOutcome {
        val saved = printerStore.get() ?: return PrintOutcome.NoPrinterConfigured

        val body: String = try {
            val resp = api.getContainerLabelTest(
                containerId = "test",
                format = saved.language,
                testMarker = "hello",
            )
            resp.string()
        } catch (e: Throwable) {
            return PrintOutcome.Err(e.friendlyMessage("Test-Druck"))
        }

        if (body.isBlank()) {
            return PrintOutcome.Err("Server hat ein leeres Test-Label zurückgegeben.")
        }

        return when (saved.transport) {
            PrinterStore.TRANSPORT_BLUETOOTH -> {
                when (val r = bluetoothPrinter.print(macAddress = saved.address, zpl = body)) {
                    is BluetoothLabelPrinter.Result.Ok ->
                        PrintOutcome.Ok(printerName = saved.name, durationMs = r.durationMs)
                    is BluetoothLabelPrinter.Result.Err ->
                        PrintOutcome.Err(r.message)
                }
            }
            PrinterStore.TRANSPORT_WIFI -> {
                when (val r = wifiPrinter.print(address = saved.address, labelBody = body)) {
                    is WifiTcpLabelPrinter.Result.Ok ->
                        PrintOutcome.Ok(printerName = saved.name, durationMs = r.durationMs)
                    is WifiTcpLabelPrinter.Result.Err ->
                        PrintOutcome.Err(r.message)
                }
            }
            else -> PrintOutcome.Err("Unbekannter Drucker-Transport: ${saved.transport}")
        }
    }

    /**
     * Druckt das Container-Label auf den gespeicherten Default-Drucker.
     * Holt sich die Label-Bytes (ZPL oder TSPL je nach Druckersprache)
     * selbst vom Backend.
     */
    suspend fun printContainerLabel(containerId: String): PrintOutcome {
        val saved = printerStore.get() ?: return PrintOutcome.NoPrinterConfigured

        // WiFi-Weg: pixel-perfektes PDF-Label als BITMAP-TSPL vom Server
        // holen und direkt an TCP:9100 durchreichen. Response ist binary
        // → als ByteArray lesen, nicht als String.
        if (saved.transport == PrinterStore.TRANSPORT_WIFI) {
            val bytes: ByteArray = try {
                val body = api.getContainerLabelTsplBitmap(containerId)
                body.bytes()
            } catch (e: Throwable) {
                return PrintOutcome.Err(e.friendlyMessage("Label-Download (BITMAP)"))
            }
            if (bytes.isEmpty()) {
                return PrintOutcome.Err("Server hat leeres BITMAP-Label zurückgegeben.")
            }
            // Sanity-Check: TSPL-Header muss am Anfang stehen (ASCII "SIZE ").
            val head = bytes.copyOfRange(0, minOf(64, bytes.size)).toString(Charsets.US_ASCII)
            if (!head.contains("SIZE ")) {
                return PrintOutcome.Err(
                    "Server hat ungültige BITMAP-Daten geliefert (kein SIZE-Header). " +
                        "Ist pdftoppm im Backend-Docker installiert?",
                )
            }
            return when (val r = wifiPrinter.printBytes(address = saved.address, bytes = bytes)) {
                is WifiTcpLabelPrinter.Result.Ok ->
                    PrintOutcome.Ok(printerName = saved.name, durationMs = r.durationMs)
                is WifiTcpLabelPrinter.Result.Err ->
                    PrintOutcome.Err(r.message)
            }
        }

        // Bluetooth-Weg (Munbyn u. Ä.): einfaches Text-TSPL/ZPL vom Backend
        // holen. Sprache je nach saved.language, keine PDF-Rasterisierung.
        val labelBody: String = try {
            val body = api.getContainerLabelZpl(containerId, format = saved.language)
            body.string()
        } catch (e: Throwable) {
            return PrintOutcome.Err(e.friendlyMessage("Label-Download"))
        }

        if (labelBody.isBlank()) {
            return PrintOutcome.Err("Server hat ein leeres Label zurückgegeben.")
        }

        val looksValid = when (saved.language) {
            PrinterStore.LANGUAGE_ZPL  -> labelBody.contains("^XA")
            PrinterStore.LANGUAGE_TSPL -> labelBody.contains("SIZE ")
            else -> true
        }
        if (!looksValid) {
            return PrintOutcome.Err(
                "Server hat ein ungültiges ${saved.language.uppercase()}-Label zurückgegeben.",
            )
        }

        return when (saved.transport) {
            PrinterStore.TRANSPORT_BLUETOOTH -> {
                when (val r = bluetoothPrinter.print(macAddress = saved.address, zpl = labelBody)) {
                    is BluetoothLabelPrinter.Result.Ok ->
                        PrintOutcome.Ok(printerName = saved.name, durationMs = r.durationMs)
                    is BluetoothLabelPrinter.Result.Err ->
                        PrintOutcome.Err(r.message)
                }
            }
            else -> PrintOutcome.Err("Unbekannter Drucker-Transport: ${saved.transport}")
        }
    }
}
