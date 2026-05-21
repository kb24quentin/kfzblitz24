package de.kfzblitz24.retoure_pda.ui.screens.case

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import de.kfzblitz24.retoure_pda.data.api.dto.CaseDetail
import de.kfzblitz24.retoure_pda.data.api.dto.PdaItem
import de.kfzblitz24.retoure_pda.data.api.dto.ScanEanResponse
import de.kfzblitz24.retoure_pda.data.api.dto.SupplierDto
import de.kfzblitz24.retoure_pda.data.repo.CaseRepository
import de.kfzblitz24.retoure_pda.data.repo.ContainerRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Wizard-Schritte. SCAN + ASSESS sind UI-seitig zusammengelegt
 * ("Artikel erfassen"). PALETTE und DONE folgen.
 */
enum class WizardStep(val label: String) {
    RECEIVE("Eingang"),
    SCAN("Artikel erfassen"),
    ASSESS("Artikel erfassen"),
    PALETTE("Palette"),
    DONE("Fertig"),
}

/**
 * Step-Derivation für eine einzelne Case. Wird auch von der Multi-Case-
 * Variante aufgerufen — das aggregierte Ergebnis ist dann der "frühste"
 * Step über alle Cases hinweg (Wizard hängt am langsamsten Case).
 *
 * Wichtig für Multi-Paket-Szenarien (Use Case 3): wenn noch registrierte
 * Items im pending-Zustand sind, muss der Wizard zurück auf SCAN selbst
 * wenn scanCompletedAt bereits gesetzt war. Sonst kann der Worker nach
 * Eingang vom 2. Paket die fehlenden Items nicht erfassen.
 */
fun deriveStep(case: CaseDetail): WizardStep {
    if (case.partnerReceivedAt == null) return WizardStep.RECEIVE

    val hasPendingRegistered = case.items.any {
        it.source == "registered" && it.status == "pending"
    }
    if (hasPendingRegistered) return WizardStep.SCAN

    if (case.scanCompletedAt == null) return WizardStep.SCAN
    if (case.items.any { it.status == "received" || it.status == "photographed" }) return WizardStep.ASSESS
    if (case.items.any { it.status == "assessed" && it.verdict != "red" }) return WizardStep.PALETTE
    return WizardStep.DONE
}

/**
 * Aggregierter Step für eine Multi-Case-Session: der "kleinste" Step
 * über alle Cases ist der globale Step. Wir können erst weitergehen
 * wenn ALLE Cases den nächsten Schritt zulassen — sonst hängt eine
 * Case im Limbo.
 *
 * Reihenfolge: RECEIVE < SCAN < ASSESS < PALETTE < DONE.
 */
fun deriveStep(cases: List<CaseDetail>): WizardStep {
    if (cases.isEmpty()) return WizardStep.RECEIVE
    return cases.map { deriveStep(it) }.minOrNull() ?: WizardStep.RECEIVE
}

/**
 * UnifiedItem — kombiniert PdaItem mit dem caseId aus dem es stammt.
 * Wird in UI-Listen verwendet damit jede Aktion auf das richtige
 * Backend-Case routen kann.
 */
data class UnifiedItem(
    val caseId: String,
    val item: PdaItem,
)

data class CaseDetailUiState(
    /** Primärer Case — der mit dem die Session geöffnet wurde. */
    val caseDetail: CaseDetail? = null,
    /** Zusätzliche Cases die per "+ Weiterer Retourenschein" hinzukamen. */
    val secondaryCases: List<CaseDetail> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
    val suppliers: List<SupplierDto> = emptyList(),
    val actionLoading: Boolean = false,
    val actionError: String? = null,
    val lastScanResult: ScanEanResponse? = null,
    /** Banner nach Hinzufügen eines weiteren Cases zur Session. */
    val addCaseBanner: String? = null,
) {
    /** Alle Cases in der Session: Primary first. */
    val allCases: List<CaseDetail>
        get() = listOfNotNull(caseDetail) + secondaryCases

    /** Alle Item-IDs aus allen Cases — für ViewModel-Routing-Lookups. */
    val unifiedItems: List<UnifiedItem>
        get() = allCases.flatMap { c -> c.items.map { UnifiedItem(c.id, it) } }
}

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

    // ── Loading ───────────────────────────────────────────────────────────────

    /**
     * Reload ALLE Cases in der aktuellen Session — primärer + alle
     * secondaries. Wird nach jeder Action gerufen damit die UI synchron
     * mit dem Backend ist.
     */
    fun load() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)
            val primaryResult = caseRepository.getCase(caseId)
            primaryResult.onSuccess { primary ->
                // Secondaries parallel nachladen
                val secondaryIds = _uiState.value.secondaryCases.map { it.id }
                val reloaded = mutableListOf<CaseDetail>()
                for (sid in secondaryIds) {
                    caseRepository.getCase(sid).onSuccess { reloaded.add(it) }
                }
                _uiState.value = _uiState.value.copy(
                    loading = false,
                    caseDetail = primary,
                    secondaryCases = reloaded,
                )
            }.onFailure { e ->
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

    // ── Multi-Case-Session: weiteren Retourenschein hinzufügen ───────────────

    /**
     * Worker scannt einen weiteren Retourenschein/Paket-Code zum selben
     * Paket. Wir machen einen Lookup, holen den Case-Detail, und hängen
     * ihn als secondary an.
     *
     * Validierung:
     *   - Code darf nicht primärer Case sein (else: silent ignore)
     *   - Code darf nicht bereits in secondaries sein (else: Banner
     *     "schon in der Session")
     */
    fun addCaseToSession(code: String) {
        val cleaned = code.trim()
        if (cleaned.isEmpty()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            caseRepository.lookup(cleaned, attachTracking = null)
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        actionError = e.message ?: "Lookup fehlgeschlagen",
                    )
                }
                .onSuccess { lookup ->
                    val foundId = lookup.case.id
                    val primaryId = _uiState.value.caseDetail?.id
                    val secondaryIds = _uiState.value.secondaryCases.map { it.id }
                    if (foundId == primaryId) {
                        _uiState.value = _uiState.value.copy(
                            actionLoading = false,
                            addCaseBanner = "Dieser Retourenschein ist bereits der primäre Case",
                        )
                        return@onSuccess
                    }
                    if (foundId in secondaryIds) {
                        _uiState.value = _uiState.value.copy(
                            actionLoading = false,
                            addCaseBanner = "Retourenschein ${lookup.case.bestellnummer} ist schon in der Session",
                        )
                        return@onSuccess
                    }
                    // Vollen Case-Detail holen und an secondaries hängen
                    caseRepository.getCase(foundId)
                        .onSuccess { detail ->
                            _uiState.value = _uiState.value.copy(
                                actionLoading = false,
                                secondaryCases = _uiState.value.secondaryCases + detail,
                                addCaseBanner = "+ ${detail.bestellnummer} zur Session hinzugefügt",
                            )
                            // Auto-receive: damit der Wizard nicht zurück
                            // auf RECEIVE springt nur weil der gerade neu
                            // hinzugefügte Case noch kein partnerReceivedAt
                            // hat. Idempotent — primärer Case wird in der
                            // gleichen Aktion nicht doppelt empfangen
                            // (receiveCase iteriert nur über null-Cases).
                            if (detail.partnerReceivedAt == null) {
                                receiveCase()
                            }
                        }
                        .onFailure { e ->
                            _uiState.value = _uiState.value.copy(
                                actionLoading = false,
                                actionError = e.message ?: "Case-Detail konnte nicht geladen werden",
                            )
                        }
                }
        }
    }

    fun clearAddCaseBanner() {
        _uiState.value = _uiState.value.copy(addCaseBanner = null)
    }

    // ── Routing-Helper: zu welchem Case gehört dieses Item? ──────────────────

    private fun caseIdForItem(itemId: String): String? =
        _uiState.value.unifiedItems.firstOrNull { it.item.id == itemId }?.caseId

    // ── Actions ───────────────────────────────────────────────────────────────

    private fun resetActionLoading() {
        _uiState.value = _uiState.value.copy(actionLoading = false, actionError = null)
    }

    /**
     * Receive: muss für JEDE Case in der Session laufen die noch nicht
     * partnerReceivedAt hat. Wir iterieren sequenziell — bei Fehler in
     * einer Case brechen wir ab und zeigen den Fehler.
     */
    fun receiveCase(onDone: () -> Unit = {}) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            val pending = _uiState.value.allCases.filter { it.partnerReceivedAt == null }
            for (c in pending) {
                val res = caseRepository.receiveCase(c.id)
                if (res.isFailure) {
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        actionError = res.exceptionOrNull()?.message,
                    )
                    return@launch
                }
            }
            resetActionLoading()
            load()
            onDone()
        }
    }

    fun scanItem(itemId: String, present: Boolean) {
        val cId = caseIdForItem(itemId) ?: run {
            _uiState.value = _uiState.value.copy(
                actionError = "Item ${itemId} keiner Case zugeordnet",
            )
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            caseRepository.scanItem(cId, itemId, present)
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
     * EAN-Scan via Multi-Case-Session-Endpoint. Auch bei nur einer Case
     * — gleicher Code-Pfad, kein Verzweigen nötig.
     */
    fun scanEan(ean: String) {
        val caseIds = _uiState.value.allCases.map { it.id }
        if (caseIds.isEmpty()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            caseRepository.scanEanInSession(caseIds, ean)
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

    fun clearLastScanResult() {
        _uiState.value = _uiState.value.copy(lastScanResult = null)
    }

    /**
     * Scan-Complete: muss für JEDE Case in der Session laufen. Pro Case
     * idempotent — wenn scanCompletedAt schon gesetzt ist, ändert
     * Backend nichts.
     */
    fun completeScanStep() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            for (c in _uiState.value.allCases) {
                if (c.scanCompletedAt != null) continue
                val res = caseRepository.scanComplete(c.id)
                if (res.isFailure) {
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        actionError = res.exceptionOrNull()?.message,
                    )
                    return@launch
                }
            }
            resetActionLoading()
            load()
        }
    }

    fun assessItem(itemId: String, score: Int, reason: String?) {
        val cId = caseIdForItem(itemId) ?: run {
            _uiState.value = _uiState.value.copy(
                actionError = "Item ${itemId} keiner Case zugeordnet",
            )
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            caseRepository.assessItem(cId, itemId, score, reason)
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
        // Container-Operation ist Case-übergreifend (Item kennt sein Case
        // selbst), Repository nimmt nur containerId + itemId.
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

    /**
     * Finalize: läuft über alle Cases der Session. Cases die schon
     * unterwegs_lieferant sind, kann das Backend idempotent ignorieren.
     */
    fun finalizeCase() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionError = null)
            for (c in _uiState.value.allCases) {
                val res = caseRepository.finalizeCase(c.id)
                if (res.isFailure) {
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        actionError = res.exceptionOrNull()?.message,
                    )
                    return@launch
                }
            }
            resetActionLoading()
            load()
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
