package de.kfzblitz24.retoure_pda.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import de.kfzblitz24.retoure_pda.data.api.dto.CaseSummary
import de.kfzblitz24.retoure_pda.data.repo.CaseRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class HomeUiState(
    val query: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    /**
     * Wenn lookup gerade erfolgreich war, ist hier die Case-ID — die
     * UI navigiert dann automatisch dorthin (LaunchedEffect in
     * HomeScreen). Danach wird das Feld wieder genullt.
     */
    val foundCaseId: String? = null,
)

class HomeViewModel(private val caseRepository: CaseRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState

    fun onQueryChange(q: String) {
        _uiState.value = _uiState.value.copy(query = q, error = null)
    }

    /** Nach erfolgreicher Navigation zurücksetzen, damit nicht
     *  unbeabsichtigt doppelt navigiert wird. */
    fun consumeFoundCase() {
        _uiState.value = _uiState.value.copy(foundCaseId = null)
    }

    fun search() {
        val q = _uiState.value.query.trim()
        if (q.isEmpty()) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)
            caseRepository.lookup(q)
                .onSuccess { resp ->
                    // Direkt zur Case-Detail-Page springen. Kein Result-
                    // Listing — UX-Anforderung: "wenn Order gefunden,
                    // soll sie direkt sich öffnen".
                    _uiState.value = _uiState.value.copy(
                        loading = false,
                        foundCaseId = resp.case.id,
                        query = "",   // input für nächste Suche freimachen
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
