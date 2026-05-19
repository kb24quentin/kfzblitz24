package de.kfzblitz24.retoure_pda.ui.screens.photos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import de.kfzblitz24.retoure_pda.data.api.dto.PhotoDto
import de.kfzblitz24.retoure_pda.data.auth.TokenStore
import de.kfzblitz24.retoure_pda.data.repo.PhotoRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.io.File

data class ItemPhotosUiState(
    val photos: List<PhotoDto> = emptyList(),
    val loading: Boolean = true,
    val uploading: Boolean = false,
    val error: String? = null,
    val uploadError: String? = null,
)

class ItemPhotosViewModel(
    private val caseId: String,
    private val itemId: String,
    private val photoRepository: PhotoRepository,
    private val tokenStore: TokenStore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ItemPhotosUiState())
    val uiState: StateFlow<ItemPhotosUiState> = _uiState

    init { loadPhotos() }

    fun loadPhotos() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)
            photoRepository.getPhotos(caseId, itemId)
                .onSuccess { list ->
                    _uiState.value = _uiState.value.copy(loading = false, photos = list)
                }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        loading = false,
                        error = e.message ?: "Fotos laden fehlgeschlagen.",
                    )
                }
        }
    }

    fun uploadPhoto(file: File, kind: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(uploading = true, uploadError = null)
            photoRepository.uploadPhoto(caseId, itemId, file, kind)
                .onSuccess { loadPhotos() }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        uploading = false,
                        uploadError = e.message ?: "Upload fehlgeschlagen.",
                    )
                }
        }
    }

    fun downloadUrl(photoId: String): String {
        return photoRepository.downloadUrl(tokenStore.getBaseUrl(), caseId, itemId, photoId)
    }

    class Factory(
        private val caseId: String,
        private val itemId: String,
        private val photoRepository: PhotoRepository,
        private val tokenStore: TokenStore,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            ItemPhotosViewModel(caseId, itemId, photoRepository, tokenStore) as T
    }
}
