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
     * Druckt das Container-Label auf den gespeicherten Default-Drucker.
     * Holt sich die ZPL-Bytes selbst vom Backend.
     */
    suspend fun printContainerLabel(containerId: String): PrintOutcome {
        val saved = printerStore.get() ?: return PrintOutcome.NoPrinterConfigured

        // 1. ZPL holen
        val zpl: String = try {
            val body = api.getContainerLabelZpl(containerId)
            body.string()
        } catch (e: Throwable) {
            return PrintOutcome.Err(e.friendlyMessage("Label-Download"))
        }

        if (zpl.isBlank() || !zpl.contains("^XA")) {
            return PrintOutcome.Err("Server hat ein ungültiges ZPL-Label zurückgegeben.")
        }

        // 2. An den passenden Transport delegieren
        return when (saved.transport) {
            PrinterStore.TRANSPORT_BLUETOOTH -> {
                when (val r = bluetoothPrinter.print(macAddress = saved.address, zpl = zpl)) {
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
