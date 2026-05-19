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
            else -> PrintOutcome.Err("Test-Druck nur für Bluetooth implementiert.")
        }
    }

    /**
     * Druckt das Container-Label auf den gespeicherten Default-Drucker.
     * Holt sich die Label-Bytes (ZPL oder TSPL je nach Druckersprache)
     * selbst vom Backend.
     */
    suspend fun printContainerLabel(containerId: String): PrintOutcome {
        val saved = printerStore.get() ?: return PrintOutcome.NoPrinterConfigured

        // 1. Label-Bytes holen — Backend liefert je nach `format`-Query
        //    entweder ZPL oder TSPL.
        val labelBody: String = try {
            val body = api.getContainerLabelZpl(containerId, format = saved.language)
            body.string()
        } catch (e: Throwable) {
            return PrintOutcome.Err(e.friendlyMessage("Label-Download"))
        }

        if (labelBody.isBlank()) {
            return PrintOutcome.Err("Server hat ein leeres Label zurückgegeben.")
        }

        // Sanity-Check: enthält die Antwort die erwarteten Start-Tokens?
        // - ZPL beginnt mit `^XA`
        // - TSPL beginnt mit `SIZE ` (uns reicht das)
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

        // 2. An den passenden Transport delegieren
        return when (saved.transport) {
            PrinterStore.TRANSPORT_BLUETOOTH -> {
                when (val r = bluetoothPrinter.print(macAddress = saved.address, zpl = labelBody)) {
                    is BluetoothLabelPrinter.Result.Ok ->
                        PrintOutcome.Ok(printerName = saved.name, durationMs = r.durationMs)
                    is BluetoothLabelPrinter.Result.Err ->
                        PrintOutcome.Err(r.message)
                }
            }
            PrinterStore.TRANSPORT_WIFI -> {
                // Stub: WiFi-Druck läuft serverseitig (siehe sendZplToPrinter()
                // im Backend). Wenn wir später WiFi-Drucker registrieren,
                // sollte dieser Pfad eher gar nicht erst erreicht werden —
                // der Server druckt selbst und antwortet "already printed".
                PrintOutcome.Err("WiFi-Druck ist noch nicht implementiert — bitte Bluetooth-Drucker wählen.")
            }
            else -> PrintOutcome.Err("Unbekannter Drucker-Transport: ${saved.transport}")
        }
    }
}
