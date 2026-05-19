package de.kfzblitz24.retoure_pda.data.printer

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Persistiert den vom User gewählten Default-Drucker (Bluetooth-MAC +
 * Friendly-Name). Liegt im selben EncryptedSharedPreferences-File wie
 * Token/PdaId, damit nur ein Master-Key existiert.
 *
 * Wir speichern bewusst nur Bluetooth-MAC + Anzeigename — kein
 * Pairing-Secret. Pairing erledigt der User in den Android-System-
 * Einstellungen, wir greifen dann auf das schon gepairte Gerät zu.
 *
 * Schema für Zukunft mit WiFi-Druckern:
 *   transport = "bluetooth" | "wifi"
 *   address   = MAC ("AA:BB:CC:DD:EE:FF")  ODER  IP[:Port] ("10.0.0.42:9100")
 *
 * Aktuell setzen wir transport nur auf "bluetooth", aber die Datenstruktur
 * ist schon zukunftssicher.
 */
class PrinterStore(context: Context) {

    companion object {
        private const val PREFS_FILE      = "retoure_pda_secure"
        private const val KEY_TRANSPORT   = "printer_transport"
        private const val KEY_ADDRESS     = "printer_address"
        private const val KEY_NAME        = "printer_name"

        const val TRANSPORT_BLUETOOTH = "bluetooth"
        const val TRANSPORT_WIFI      = "wifi"
    }

    private val prefs: SharedPreferences = run {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            PREFS_FILE,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    data class SavedPrinter(
        val transport: String,
        val address: String,
        val name: String,
    )

    /** Gibt den gespeicherten Default-Drucker zurück, oder null wenn keiner gesetzt. */
    fun get(): SavedPrinter? {
        val t = prefs.getString(KEY_TRANSPORT, null) ?: return null
        val a = prefs.getString(KEY_ADDRESS, null) ?: return null
        val n = prefs.getString(KEY_NAME, null) ?: a
        return SavedPrinter(transport = t, address = a, name = n)
    }

    fun save(printer: SavedPrinter) {
        prefs.edit()
            .putString(KEY_TRANSPORT, printer.transport)
            .putString(KEY_ADDRESS, printer.address)
            .putString(KEY_NAME, printer.name)
            .apply()
    }

    fun clear() {
        prefs.edit()
            .remove(KEY_TRANSPORT)
            .remove(KEY_ADDRESS)
            .remove(KEY_NAME)
            .apply()
    }

    fun has(): Boolean = get() != null
}
