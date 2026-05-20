package de.kfzblitz24.retoure_pda.ui.screens.case

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import de.kfzblitz24.retoure_pda.data.api.dto.CaseDetail
import de.kfzblitz24.retoure_pda.data.api.dto.ScanEanResponse
import de.kfzblitz24.retoure_pda.data.api.dto.SupplierDto
import de.kfzblitz24.retoure_pda.data.repo.CaseRepository
import de.kfzblitz24.retoure_pda.data.repo.ContainerRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Wizard-Schritte. Seit dem Inline-Rating-Pass sind SCAN + Bewertung
 * EIN Schritt — pro Artikel scannen + sofort bewerten. Daher kein
 * separater "Bewerten"-Step mehr im Top-Indicator. Falls items vom
 * Fallback-Pfad (manuelle Da/Fehlt-Buttons ohne EAN-Scan) noch
 * bewertet werden müssen, bleiben wir trotzdem im "Erfassen"-Step —
 * die Fallback-Liste/Anzeige passiert dort inline.
 */
enum class WizardStep(val label: String) {
    RECEIVE("Eingang"),
    SCAN("Artikel erfassen"),
    ASSESS("Artikel erfassen"),  // gleicher Label-Text → optisch ein Step
    PALETTE("Palette"),
    DONE("Fertig"),
}

/**
 * Leitet den aktuellen Wizard-Schritt aus den Case-Daten ab.
 *
 *   - kein partnerReceivedAt          → RECEIVE
 *   - scanCompletedAt nicht gesetzt   → SCAN ("Artikel erfassen")
 *       Inline-Rating passiert innerhalb dieses Steps.
 *   - irgendein Item mit status=received|photographed → ASSESS
 *       (Fallback: nur wenn ein Item ohne EAN per Da-Button bestätigt
 *       wurde und deshalb durch den Inline-Pfad nicht gerated wurde)
 *   - irgendein Item assessed mit verdict ≠ red → PALETTE
 *   - sonst → DONE
 */
fun deriveStep(case: CaseDetail): WizardStep {
    if (case.partnerReceivedAt == null) return WizardStep.RECEIVE
    if (case.scanCompletedAt == null) return WizardStep.SCAN
    if (case.items.any { it.status == "received" || it.status == "photographed" }) return WizardStep.ASSESS
    if (case.items.any { it.status == "assessed" && it.verdict != "red" }) return WizardStep.PALETTE
    return WizardStep.DONE
}

data class CaseDetailUiState(
    val caseDetail: CaseDetail? = null,
    val loading: Boolean = true,
    val error: String? = null,
    val suppliers: List<SupplierDto> = emptyList(),
    val actionLoading: Boolean = false,
    val actionError: String? = null,
    /** Letztes Scan-Ergebnis fürs Big-OK/NOT-OK-Display im ScanStep. */
    val lastScanResult: ScanEanResponse? = null,
    /** Toast/Banner nach dem Hinzufügen eines weiteren Pakets. */
    val addPackageBanner: String? = null,
)

class CaseDetailViewModel(
    private val caseId: String,
    private val caseRepository: CaseRepository,
    private val containerRepository: ContainerRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(CaseDetailUiState())
    val uiState: StateFlow<CaseDetailUiState> = _uiState

    init {
        load()
        loadSuppliers()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)
            caseRepository.getCase(caseId)
                .onSuccess { detail ->
                    _uiState.value = _uiState.value.copy(loading = false, caseDetail = detail)
                }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        loading = false,
                        error = e.message ?: "Laden fehlgeschlagen.",
                    )
                }
        }
    }

    private fun loadSuppliers() {
        viewModelScope.launch {
            caseRepository.getSuppliers()
                .onSuccess { list ->
                    _uiState.value = _uiState.value.copy(suppliers = list)
                }
        }
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    // Alle Action-Funktionen folgen demselben Pattern:
    //   - actionLoading=true, actionError=null beim Start
    //   - actionLoading=false + reload() bei Success
    //   - actionLoading=false + Fehlermeldung bei Failure
    // Der Bug vorher: bei Success wurde load() gerufen, aber load()
    // touched `loading`, nicht `actionLoading` — also blieb der Button
    // ewig im Spinner-State hängen.

    private fun resetActionLoading() {
        _uiState.value = _uiState.value.copy(actionLoading = false, actionError = null)
    }

    fun receiveCase(onDone: () -> Unit = {}) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            caseRepository.receiveCase(caseId)
                .onSuccess { resetActionLoading(); load(); onDone() }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        actionError = e.message,
                    )
                }
        }
    }

    fun scanItem(itemId: String, present: Boolean) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            caseRepository.scanItem(caseId, itemId, present)
                .onSuccess { resetActionLoading(); load() }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        actionError = e.message,
                    )
                }
        }
    }

    /**
     * EAN-Scan: ein Aufruf, Server klassifiziert automatisch (registered/
     * extra/unknown). Result landet in `lastScanResult` für die GROßE
     * GRÜN/ROT-Anzeige im ScanStep. Anschliessend neuladen damit die
     * Item-Liste den neuen Status reflektiert.
     */
    fun scanEan(ean: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            caseRepository.scanEan(caseId, ean)
                .onSuccess { result ->
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        actionError = null,
                        lastScanResult = result,
                    )
                    load()
                }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        actionError = e.message,
                    )
                }
        }
    }

    /** Räumt das letzte Scan-Ergebnis ab — z. B. wenn der User weiterklickt. */
    fun clearLastScanResult() {
        _uiState.value = _uiState.value.copy(lastScanResult = null)
    }

    /** Worker tappt "Fertig mit Scannen" → Wizard advanced zu ASSESS. */
    fun completeScanStep() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            caseRepository.scanComplete(caseId)
                .onSuccess { resetActionLoading(); load() }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        actionError = e.message,
                    )
                }
        }
    }

    /** Hängt ein weiteres Paket an die Retoure an (Multi-Paket-Szenario). */
    fun addPackage(tracking: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            caseRepository.addPackage(caseId, tracking)
                .onSuccess { resp ->
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        addPackageBanner = resp.message,
                    )
                    load()
                }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        actionError = e.message,
                    )
                }
        }
    }

    fun clearAddPackageBanner() {
        _uiState.value = _uiState.value.copy(addPackageBanner = null)
    }

    fun assessItem(itemId: String, score: Int, reason: String?) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            caseRepository.assessItem(caseId, itemId, score, reason)
                .onSuccess { resetActionLoading(); load() }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        actionError = e.message,
                    )
                }
        }
    }

    fun addItemToContainer(containerId: String, itemId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            containerRepository.addItemToContainer(containerId, itemId)
                .onSuccess { resetActionLoading(); load() }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        actionError = e.message,
                    )
                }
        }
    }

    fun createContainerAndAddItem(supplierId: String, itemId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            containerRepository.createContainer(supplierId)
                .onSuccess { created ->
                    containerRepository.addItemToContainer(created.id, itemId)
                        .onSuccess { resetActionLoading(); load() }
                        .onFailure { e ->
                            _uiState.value = _uiState.value.copy(
                                actionLoading = false,
                                actionError = e.message,
                            )
                        }
                }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        actionError = e.message,
                    )
                }
        }
    }

    fun finalizeCase() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            caseRepository.finalizeCase(caseId)
                .onSuccess { resetActionLoading(); load() }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        actionError = e.message,
                    )
                }
        }
    }

    fun clearActionError() {
        _uiState.value = _uiState.value.copy(actionError = null)
    }

    class Factory(
        private val caseId: String,
        private val caseRepository: CaseRepository,
        private val containerRepository: ContainerRepository,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            CaseDetailViewModel(caseId, caseRepository, containerRepository) as T
    }
}
