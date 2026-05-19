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
        private const val KEY_LANGUAGE    = "printer_language"

        const val TRANSPORT_BLUETOOTH = "bluetooth"
        const val TRANSPORT_WIFI      = "wifi"

        /** TSPL — Default für Munbyn-Portables. */
        const val LANGUAGE_TSPL = "tspl"
        /** ZPL — echte Zebra-Drucker oder Subset-Drucker im ZPL-Mode. */
        const val LANGUAGE_ZPL  = "zpl"

        const val DEFAULT_LANGUAGE = LANGUAGE_TSPL
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
        /**
         * Druckersprache. "tspl" oder "zpl". TSPL ist Default weil
         * Munbyn-Portable-Drucker out-of-the-box TSPL sprechen.
         */
        val language: String = DEFAULT_LANGUAGE,
    )

    /** Gibt den gespeicherten Default-Drucker zurück, oder null wenn keiner gesetzt. */
    fun get(): SavedPrinter? {
        val t = prefs.getString(KEY_TRANSPORT, null) ?: return null
        val a = prefs.getString(KEY_ADDRESS, null) ?: return null
        val n = prefs.getString(KEY_NAME, null) ?: a
        val l = prefs.getString(KEY_LANGUAGE, null) ?: DEFAULT_LANGUAGE
        return SavedPrinter(transport = t, address = a, name = n, language = l)
    }

    fun save(printer: SavedPrinter) {
        prefs.edit()
            .putString(KEY_TRANSPORT, printer.transport)
            .putString(KEY_ADDRESS, printer.address)
            .putString(KEY_NAME, printer.name)
            .putString(KEY_LANGUAGE, printer.language)
            .apply()
    }

    /** Druckersprache einzeln updaten, ohne den ganzen Eintrag neu zu speichern. */
    fun setLanguage(language: String) {
        prefs.edit().putString(KEY_LANGUAGE, language).apply()
    }

    fun clear() {
        prefs.edit()
            .remove(KEY_TRANSPORT)
            .remove(KEY_ADDRESS)
            .remove(KEY_NAME)
            .remove(KEY_LANGUAGE)
            .apply()
    }

    fun has(): Boolean = get() != null
}
