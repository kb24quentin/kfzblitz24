package de.kfzblitz24.retoure_pda.data.repo

import de.kfzblitz24.retoure_pda.data.api.RetoureApi
import de.kfzblitz24.retoure_pda.data.api.dto.*
import de.kfzblitz24.retoure_pda.data.api.safeApi
import de.kfzblitz24.retoure_pda.data.auth.TokenStore

class CaseRepository(
    private val api: RetoureApi,
    private val tokenStore: TokenStore,
) {
    suspend fun lookup(
        query: String,
        /** Optional: zuvor gescanntes Paket-Label, wird beim Case angehängt. */
        attachTracking: String? = null,
    ): Result<LookupResponse> =
        safeApi("Bestellung \"$query\"") {
            api.lookupCases(query, attachTracking?.takeIf { it.isNotBlank() })
        }

    suspend fun getCase(id: String): Result<CaseDetail> =
        safeApi("Retoure") {
            api.getCase(id)
        }

    suspend fun receiveCase(caseId: String): Result<Unit> =
        safeApi("Eingang erfassen") {
            val pdaId = tokenStore.getPdaId() ?: "unknown"
            api.receiveCase(caseId, ReceiveRequest(pdaId = pdaId))
            Unit
        }

    suspend fun scanItem(
        caseId: String,
        itemId: String,
        present: Boolean,
    ): Result<Unit> = safeApi("Artikel bestätigen") {
        val pdaId = tokenStore.getPdaId() ?: "unknown"
        api.scanItem(caseId, itemId, ScanRequest(present = present, pdaId = pdaId))
        Unit
    }

    /**
     * EAN-Scan-Endpoint — Worker scannt einen Code, Server klassifiziert
     * automatisch (registered/extra/unknown).
     */
    suspend fun scanEan(
        caseId: String,
        ean: String,
    ): Result<ScanEanResponse> = safeApi("EAN scannen") {
        val pdaId = tokenStore.getPdaId() ?: "unknown"
        api.scanEan(caseId, ScanEanRequest(ean = ean, pdaId = pdaId))
    }

    /**
     * Multi-Case-Variante: matched gegen ALLE übergebenen Cases. Response
     * enthält `matchedCaseId` damit das ViewModel weiß welcher Case
     * betroffen war.
     */
    suspend fun scanEanInSession(
        caseIds: List<String>,
        ean: String,
    ): Result<ScanEanResponse> = safeApi("EAN scannen") {
        val pdaId = tokenStore.getPdaId() ?: "unknown"
        api.scanEanInSession(
            SessionScanEanRequest(
                caseIds = caseIds,
                ean = ean,
                pdaId = pdaId,
            ),
        )
    }

    /** Worker tappt "Fertig mit Scannen" → Wizard advanced. */
    suspend fun scanComplete(caseId: String): Result<Unit> =
        safeApi("Scan abschließen") {
            val pdaId = tokenStore.getPdaId() ?: "unknown"
            api.scanComplete(caseId, ScanCompleteRequest(pdaId = pdaId))
            Unit
        }

    /** Hängt ein weiteres Paket-Tracking an die Retoure (Multi-Paket). */
    suspend fun addPackage(
        caseId: String,
        tracking: String,
    ): Result<AddPackageResponse> = safeApi("Weiteres Paket hinzufügen") {
        val pdaId = tokenStore.getPdaId() ?: "unknown"
        api.addPackage(caseId, AddPackageRequest(tracking = tracking, pdaId = pdaId))
    }

    suspend fun assessItem(
        caseId: String,
        itemId: String,
        score: Int,
        reason: String?,
    ): Result<Unit> = safeApi("Bewertung speichern") {
        val pdaId = tokenStore.getPdaId() ?: "unknown"
        api.assessItem(
            caseId,
            itemId,
            AssessRequest(
                employeeScore = score,
                verdictReason = reason?.takeIf { it.isNotBlank() },
                pdaId = pdaId,
            ),
        )
        Unit
    }

    suspend fun finalizeCase(caseId: String): Result<Unit> =
        safeApi("Case abschließen") {
            val pdaId = tokenStore.getPdaId() ?: "unknown"
            api.finalizeCase(caseId, FinalizeRequest(pdaId = pdaId))
            Unit
        }

    suspend fun getSuppliers(): Result<List<SupplierDto>> =
        safeApi("Lieferanten") {
            api.getSuppliers().suppliers
        }
}
