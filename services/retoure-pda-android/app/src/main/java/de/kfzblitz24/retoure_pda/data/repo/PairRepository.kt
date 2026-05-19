package de.kfzblitz24.retoure_pda.data.repo

import de.kfzblitz24.retoure_pda.data.api.RetoureApi
import de.kfzblitz24.retoure_pda.data.api.dto.PairRequest
import de.kfzblitz24.retoure_pda.data.auth.TokenStore

class PairRepository(
    private val api: RetoureApi,
    private val tokenStore: TokenStore,
) {
    /**
     * Tauscht den Pairing-Code gegen Token + PdaId aus und speichert
     * beides im TokenStore.
     *
     * Der Code kann in zwei Formaten kommen:
     *   1. Volle URL: https://pda.rma.…/pda-app/pair?code=PDA-XXXX-XXXX
     *      → wir extrahieren den `code`-Query-Param
     *   2. Reiner Code: PDA-XXXX-XXXX
     *      → direkt verwenden
     */
    suspend fun pair(rawInput: String): Result<Unit> {
        return try {
            val code = extractCode(rawInput)
            val response = api.pair(PairRequest(code = code))
            tokenStore.setToken(response.token)
            tokenStore.setPdaId(response.pdaId)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun extractCode(input: String): String {
        val trimmed = input.trim()
        return if (trimmed.startsWith("http")) {
            // URL → extrahiere ?code=
            val uri = android.net.Uri.parse(trimmed)
            uri.getQueryParameter("code") ?: trimmed
        } else {
            trimmed
        }
    }
}
