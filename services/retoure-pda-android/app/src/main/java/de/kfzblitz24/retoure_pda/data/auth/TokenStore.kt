package de.kfzblitz24.retoure_pda.data.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Persistenter, verschlüsselter Storage für PDA-Credentials.
 *
 * Verwendet EncryptedSharedPreferences (AES256-GCM) via AndroidKeyStore.
 * Der MasterKey wird beim ersten Aufruf erzeugt und danach vom Keystore
 * verwaltet — kein Plaintext-Schlüssel im App-Code.
 *
 * Keys:
 *   token    — Bearer-Token (nach erfolgreichem Pairing)
 *   pdaId    — Friendly-Name des Geräts (z. B. "Lager-Nord")
 *   baseUrl  — Konfigurierbare Base-URL (Standard: staging)
 *
 * Hinweis: Wenn das Gerät-Keystore nach Factory-Reset o. Ä. korrumpiert
 * ist, wirft EncryptedSharedPreferences eine Exception. In diesem Fall
 * sollte die App-Daten gelöscht und neu gepairt werden.
 */
class TokenStore(context: Context) {

    companion object {
        private const val PREFS_FILE  = "retoure_pda_secure"
        private const val KEY_TOKEN   = "token"
        private const val KEY_PDA_ID  = "pdaId"
        private const val KEY_BASE_URL = "baseUrl"

        const val DEFAULT_BASE_URL = "https://pda.rma.staging.kfzblitz24-group.com"
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

    // ── Token ─────────────────────────────────────────────────────────────────

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)

    fun setToken(token: String) = prefs.edit().putString(KEY_TOKEN, token).apply()

    fun hasToken(): Boolean = !getToken().isNullOrEmpty()

    // ── PDA-ID ────────────────────────────────────────────────────────────────

    fun getPdaId(): String? = prefs.getString(KEY_PDA_ID, null)

    fun setPdaId(pdaId: String) = prefs.edit().putString(KEY_PDA_ID, pdaId).apply()

    // ── Base-URL ──────────────────────────────────────────────────────────────

    fun getBaseUrl(): String =
        prefs.getString(KEY_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL

    fun setBaseUrl(url: String) {
        val normalized = url.trimEnd('/')
        prefs.edit().putString(KEY_BASE_URL, normalized).apply()
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    /**
     * Löscht Token + PdaId. Base-URL bleibt für den nächsten Pair-Versuch
     * erhalten — der User muss sonst nach dem Logout die URL neu setzen,
     * obwohl sich die Stage nicht geändert hat.
     */
    fun clear() {
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_PDA_ID)
            .apply()
    }
}
