package de.kfzblitz24.retoure_pda.data.printer

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.util.UUID

/**
 * Schickt ZPL-Bytes per Bluetooth-SPP (RFCOMM) an einen gepairten Drucker.
 *
 * Funktioniert mit allen Druckern die das "Serial Port Profile" (SPP)
 * exponieren — Munbyn RW403B, Zebra ZQ-Serie, Brother PT-Drucker,
 * generische "ZJ-58" Bons. Wir reden RAW Bytes; der Drucker entscheidet
 * selbst was er damit anfängt (ZPL, ESC/POS, CPCL — alles möglich).
 *
 * Wichtig:
 *   - Drucker MUSS in den Android-System-Einstellungen schon gepairt sein
 *     (wir bieten kein In-App-Pairing).
 *   - Auf Android 12+ braucht der Aufruf BLUETOOTH_CONNECT-Permission.
 *   - Standard-SPP-UUID `00001101-0000-1000-8000-00805F9B34FB` —
 *     identisch für alle SPP-Drucker.
 */
class BluetoothLabelPrinter(private val context: Context) {

    companion object {
        private const val TAG = "PdaBtPrinter"
        /** Serial Port Profile (SPP) — universelle UUID für seriellen RFCOMM-Stream. */
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }

    /** Ergebnis-Typ — diskriminierte Union, Caller verzweigt auf `ok`. */
    sealed class Result {
        data class Ok(val durationMs: Long, val bytesSent: Int) : Result()
        data class Err(val message: String) : Result()
    }

    /**
     * Liefert alle System-gepairten Bluetooth-Geräte zurück.
     * Wird im SelectPrinterScreen benutzt um eine Auswahl-Liste zu zeigen.
     * Filtert NICHT auf Drucker — der User entscheidet (manche Hersteller
     * setzen keine Major-Class "Imaging").
     */
    @SuppressLint("MissingPermission") // wir prüfen explizit unten
    fun bondedDevices(): List<BluetoothDevice> {
        if (!hasConnectPermission()) return emptyList()
        val adapter = getAdapter() ?: return emptyList()
        if (!adapter.isEnabled) return emptyList()
        return adapter.bondedDevices?.toList() ?: emptyList()
    }

    /** True wenn Bluetooth auf dem Gerät hardwaremäßig verfügbar UND eingeschaltet ist. */
    fun isReady(): Boolean {
        val adapter = getAdapter() ?: return false
        return adapter.isEnabled && hasConnectPermission()
    }

    /**
     * Schickt die ZPL-Bytes an einen Drucker und schließt die Verbindung.
     *
     * @param macAddress  Bluetooth-MAC des Druckers (aus PrinterStore).
     * @param zpl         Komplettes ZPL-Dokument (muss `^XA…^XZ` enthalten).
     * @param connectTimeoutMs  Wie lange wir auf die SPP-Verbindung warten.
     */
    @SuppressLint("MissingPermission") // wir prüfen explizit
    suspend fun print(
        macAddress: String,
        zpl: String,
        connectTimeoutMs: Long = 8_000,
    ): Result = withContext(Dispatchers.IO) {
        val started = System.currentTimeMillis()

        if (!hasConnectPermission()) {
            return@withContext Result.Err("Bluetooth-Berechtigung fehlt — bitte in den App-Einstellungen erlauben.")
        }

        val adapter = getAdapter()
            ?: return@withContext Result.Err("Bluetooth nicht verfügbar auf diesem Gerät.")

        if (!adapter.isEnabled) {
            return@withContext Result.Err("Bluetooth ist aus — bitte in den System-Einstellungen aktivieren.")
        }

        val device: BluetoothDevice = try {
            adapter.getRemoteDevice(macAddress)
        } catch (e: IllegalArgumentException) {
            return@withContext Result.Err("Ungültige Drucker-Adresse: ${e.message}")
        }

        // Discovery beenden bevor wir eine Verbindung aufbauen — Android-Empfehlung,
        // sonst kann der SDP-Lookup deadlocken.
        try { adapter.cancelDiscovery() } catch (_: SecurityException) { /* ignore */ }

        var socket: BluetoothSocket? = null
        try {
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            // connect() blockiert. Wir laufen schon im IO-Dispatcher.
            // Es gibt kein eingebautes Connect-Timeout in BluetoothSocket, also
            // setzen wir uns ein hartes Limit über `withTimeoutOrNull`.
            val connected = kotlinx.coroutines.withTimeoutOrNull(connectTimeoutMs) {
                socket.connect()
                true
            } ?: run {
                try { socket.close() } catch (_: IOException) {}
                return@withContext Result.Err(
                    "Drucker '${device.name ?: macAddress}' antwortet nicht — eingeschaltet? Akku? In Reichweite?"
                )
            }
            if (!connected) {
                return@withContext Result.Err("Verbindung zu '${device.name ?: macAddress}' fehlgeschlagen.")
            }

            val bytes = zpl.toByteArray(Charsets.UTF_8)
            socket.outputStream.use { out ->
                out.write(bytes)
                out.flush()
            }

            val duration = System.currentTimeMillis() - started
            Log.d(TAG, "Printed ${bytes.size} ZPL bytes to ${device.name} in ${duration}ms")
            Result.Ok(durationMs = duration, bytesSent = bytes.size)
        } catch (e: SecurityException) {
            Result.Err("Bluetooth-Berechtigung wurde entzogen — bitte erneut erlauben.")
        } catch (e: IOException) {
            Log.w(TAG, "Print failed", e)
            Result.Err(friendlyIoError(e, device.name ?: macAddress))
        } finally {
            try { socket?.close() } catch (_: IOException) { /* ignore */ }
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private fun getAdapter(): BluetoothAdapter? {
        val mgr = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        return mgr?.adapter
    }

    private fun hasConnectPermission(): Boolean {
        // BLUETOOTH_CONNECT ist erst ab API 31 (Android 12) Runtime-Permission.
        // Auf älteren Geräten reicht die Manifest-Deklaration.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.BLUETOOTH_CONNECT
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun friendlyIoError(e: IOException, deviceName: String): String {
        val msg = e.message ?: "unbekannter Fehler"
        return when {
            "socket closed" in msg.lowercase() ->
                "Verbindung zu '$deviceName' wurde getrennt. Drucker prüfen und erneut versuchen."
            "service discovery failed" in msg.lowercase() ->
                "'$deviceName' bietet kein SPP-Profil. Anderen Drucker wählen."
            "read failed" in msg.lowercase() || "broken pipe" in msg.lowercase() ->
                "Drucker hat die Verbindung mitten im Druck verloren."
            else ->
                "Bluetooth-Fehler beim Drucken auf '$deviceName': $msg"
        }
    }
}
