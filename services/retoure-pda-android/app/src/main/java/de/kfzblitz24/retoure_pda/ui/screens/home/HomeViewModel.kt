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
    val results: List<CaseSummary> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,
)

class HomeViewModel(private val caseRepository: CaseRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState

    fun onQueryChange(q: String) {
        _uiState.value = _uiState.value.copy(query = q, error = null)
    }

    fun search() {
        val q = _uiState.value.query.trim()
        if (q.isEmpty()) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)
            caseRepository.lookup(q)
                .onSuccess { resp ->
                    // Backend liefert immer genau einen Treffer (oder 404).
                    // Wir wrappen in eine 1-Element-Liste, damit die UI
                    // wiederverwendbar bleibt.
                    _uiState.value = _uiState.value.copy(
                        loading = false,
                        results = listOf(resp.case),
                        error = null,
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
