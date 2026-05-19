package de.kfzblitz24.retoure_pda.data.api

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/**
 * User-freundliche Fehlermeldungen für unsere REST-Aufrufe.
 *
 * Statt rohen "HTTP 404" / "Unable to resolve host" zu zeigen, mappen
 * wir bekannte Fehler-Klassen auf konkrete deutsche Texte und versuchen
 * den `error`-/`message`-Body vom Server zu lesen — die Next.js-Routes
 * antworten z. B. mit `{"error":"Keine Retoure gefunden"}` bei 404, das
 * wollen wir natürlich vor dem User zeigen, statt ein generisches
 * "404 — nicht gefunden".
 *
 * Nutzung in Repos:
 *   suspend fun lookup(q: String) = safeApi("Bestellung \"$q\"") {
 *       api.lookupCases(q)
 *   }
 */

private val errorJson = Json {
    ignoreUnknownKeys = true
    isLenient = true
}

/**
 * Versucht aus einem HTTP-Error-Body den Backend-`error`-Text zu ziehen.
 * Wenn das nicht gelingt (Body leer oder kein JSON), `null`.
 */
private fun HttpException.parseBackendError(): String? {
    val raw = try {
        response()?.errorBody()?.string()
    } catch (_: Throwable) {
        null
    } ?: return null
    if (raw.isBlank()) return null
    // Erst-Versuch: JSON mit `error`-Feld
    return try {
        val obj = errorJson.parseToJsonElement(raw).let {
            if (it is kotlinx.serialization.json.JsonObject) it else null
        } ?: return null
        (obj["error"] ?: obj["message"])
            ?.let { el ->
                if (el is kotlinx.serialization.json.JsonPrimitive) el.content else null
            }
    } catch (_: SerializationException) {
        // Fallback: roher String (falls Backend mal Plaintext schickt)
        raw.take(200).takeIf { it.isNotBlank() }
    } catch (_: Throwable) {
        null
    }
}

/**
 * Übersetzt eine beliebige Exception in eine deutsche User-Meldung.
 * Optionaler `context` (z. B. "Bestellung \"KB24-…\"") wird mit
 * eingebaut wenn das Backend selber keinen Text liefert.
 */
fun Throwable.friendlyMessage(context: String? = null): String {
    return when (this) {
        is HttpException -> {
            val backendMsg = parseBackendError()
            when (code()) {
                401 -> backendMsg
                    ?: "Nicht angemeldet — bitte App neu pairen (Einstellungen → Logout)."
                403 -> backendMsg ?: "Zugriff verweigert."
                404 -> backendMsg
                    ?: (context?.let { "$it nicht gefunden." } ?: "Nicht gefunden.")
                409 -> backendMsg
                    ?: "Konflikt mit dem aktuellen Stand — bitte aktualisieren und nochmal versuchen."
                410 -> backendMsg
                    ?: "Die Resource ist nicht mehr verfügbar."
                413 -> "Datei zu groß. Bitte ein kleineres Foto wählen."
                429 -> "Zu viele Anfragen — kurz warten und nochmal."
                500, 502, 503, 504 -> backendMsg
                    ?: "Server-Fehler (HTTP ${code()}). Probier's in ein paar Sekunden nochmal."
                else -> backendMsg ?: "Server-Antwort: HTTP ${code()}"
            }
        }
        is UnknownHostException ->
            "Keine Verbindung — ist WLAN an? (Host nicht erreichbar)"
        is SocketTimeoutException ->
            "Antwort dauert zu lang — Verbindung schwach?"
        is IOException ->
            "Netzwerk-Fehler: ${message ?: "Verbindung unterbrochen"}"
        else ->
            message?.takeIf { it.isNotBlank() } ?: "Unbekannter Fehler."
    }
}

/**
 * Wrappt einen API-Call so dass Erfolg → Result.success, Fehler →
 * Result.failure mit übersetzter Message.
 *
 * `context` ist eine kurze Beschreibung was gerade versucht wird
 * (z. B. "Bestellung \"KB24-…\""), die bei 404 mit angezeigt wird
 * falls das Backend selber keinen Text liefert.
 */
suspend inline fun <T> safeApi(
    context: String? = null,
    block: () -> T,
): Result<T> {
    return try {
        Result.success(block())
    } catch (e: Throwable) {
        Result.failure(RuntimeException(e.friendlyMessage(context)))
    }
}
