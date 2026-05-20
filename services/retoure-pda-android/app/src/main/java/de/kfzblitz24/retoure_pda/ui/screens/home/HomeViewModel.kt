package de.kfzblitz24.retoure_pda.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import de.kfzblitz24.retoure_pda.data.repo.CaseRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * 2-stufiger Scan-Flow:
 *   STUFE 1 (waiting=null):       "Scanne das Paket-Label."
 *                                  Wenn Paket bekannt → navigieren.
 *                                  Wenn Paket unbekannt → Stufe 2.
 *   STUFE 2 (waiting=<paketCode>): "Paket noch nicht zugeordnet.
 *                                   Scanne den Retourenschein."
 *                                  Lookup mit withTracking=<paketCode> →
 *                                  Case wird gefunden, Tracking automatisch
 *                                  am Case gespeichert.
 *
 * Manuelle Eingabe (Dialog) bleibt flexibel — akzeptiert beide
 * Code-Arten ohne 2-Stufen-Logik.
 */
data class HomeUiState(
    val query: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    /**
     * In Stufe 2: das zuvor gescannte Paket-Label, das beim nächsten
     * Lookup (Retourenschein) als withTracking mitgeschickt wird.
     * `null` = Stufe 1, sonst Stufe 2.
     */
    val pendingPackageCode: String? = null,
    /**
     * Wenn lookup gerade erfolgreich war, ist hier die Case-ID. Die
     * UI navigiert dann automatisch dorthin und ruft `consumeFoundCase()`.
     */
    val foundCaseId: String? = null,
    /**
     * Toast/Banner-Flag: "Paket-Label wurde am Case gespeichert".
     */
    val packageLabelAttached: Boolean = false,
)

class HomeViewModel(private val caseRepository: CaseRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState

    fun onQueryChange(q: String) {
        _uiState.value = _uiState.value.copy(query = q, error = null)
    }

    fun consumeFoundCase() {
        _uiState.value = _uiState.value.copy(
            foundCaseId = null,
            packageLabelAttached = false,
            pendingPackageCode = null,
            query = "",
        )
    }

    /** "Anderen Scan starten" — verwirft pendingPackageCode + Error. */
    fun resetScanFlow() {
        _uiState.value = HomeUiState()
    }

    /**
     * Lookup via Scanner: 2-stufige Logik.
     *   - Stufe 1 (kein pending): einfacher Lookup. Bei 404 → Stufe 2.
     *   - Stufe 2 (mit pending):  Lookup mit withTracking=<pending>.
     *                             Erfolg → navigieren + Banner setzen.
     */
    fun search() {
        val q = _uiState.value.query.trim()
        if (q.isEmpty()) return
        val pending = _uiState.value.pendingPackageCode

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)
            caseRepository.lookup(query = q, attachTracking = pending)
                .onSuccess { resp ->
                    _uiState.value = _uiState.value.copy(
                        loading = false,
                        foundCaseId = resp.case.id,
                        packageLabelAttached = resp.attachedTracking,
                    )
                }
                .onFailure { e ->
                    val msg = e.message ?: "Suche fehlgeschlagen."
                    // 404-Heuristik: Backend antwortet mit "Keine Retoure
                    // gefunden" oder mit dem Context-Fallback
                    // "Bestellung \"XYZ\" nicht gefunden". Beides matchen
                    // wir auf das Wort "gefunden" — dann ist's eindeutig
                    // ein not-found Fall.
                    val isNotFound = msg.contains("gefunden", ignoreCase = true) ||
                        msg.contains("404")
                    if (isNotFound && pending == null) {
                        // Stufe 1 → Stufe 2: Paket-Code merken, neuen Prompt
                        _uiState.value = _uiState.value.copy(
                            loading = false,
                            pendingPackageCode = q,
                            query = "",
                            error = null,
                        )
                    } else {
                        _uiState.value = _uiState.value.copy(
                            loading = false,
                            error = msg,
                        )
                    }
                }
        }
    }

    /** Im Manual-Dialog: führt nur einen Standard-Lookup ohne Stufen-Logik aus. */
    fun manualLookup(code: String) {
        val q = code.trim()
        if (q.isEmpty()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)
            caseRepository.lookup(query = q, attachTracking = null)
                .onSuccess { resp ->
                    _uiState.value = _uiState.value.copy(
                        loading = false,
                        foundCaseId = resp.case.id,
                        query = "",
                    )
                }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        loading = false,
                        error = e.message ?: "Suche fehlgeschlagen.",
                    )
                }
        }
    }

    class Factory(private val repo: CaseRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            HomeViewModel(repo) as T
    }
}
