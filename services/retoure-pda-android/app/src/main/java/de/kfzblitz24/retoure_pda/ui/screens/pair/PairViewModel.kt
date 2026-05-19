package de.kfzblitz24.retoure_pda.ui.screens.pair

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import de.kfzblitz24.retoure_pda.data.repo.PairRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class PairUiState(
    val codeInput: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val paired: Boolean = false,
)

class PairViewModel(
    private val pairRepository: PairRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PairUiState())
    val uiState: StateFlow<PairUiState> = _uiState

    fun onCodeChange(value: String) {
        _uiState.value = _uiState.value.copy(codeInput = value, error = null)
    }

    /**
     * Wird sowohl beim manuellen Absenden des Eingabefelds als auch
     * nach ML-Kit QR-Scan aufgerufen. rawInput kann volle URL oder
     * purer Code sein — PairRepository extrahiert den Code.
     */
    fun pair(rawInput: String = _uiState.value.codeInput) {
        val code = rawInput.trim()
        if (code.isEmpty()) {
            _uiState.value = _uiState.value.copy(error = "Bitte Pairing-Code eingeben.")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)
            pairRepository.pair(code)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(loading = false, paired = true)
                }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        loading = false,
                        error = e.message ?: "Pairing fehlgeschlagen.",
                    )
                }
        }
    }

    class Factory(private val repo: PairRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            PairViewModel(repo) as T
    }
}
