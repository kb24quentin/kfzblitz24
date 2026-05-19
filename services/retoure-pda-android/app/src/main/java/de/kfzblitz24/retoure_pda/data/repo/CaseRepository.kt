package de.kfzblitz24.retoure_pda.data.repo

import de.kfzblitz24.retoure_pda.data.api.RetoureApi
import de.kfzblitz24.retoure_pda.data.api.dto.*
import de.kfzblitz24.retoure_pda.data.auth.TokenStore

class CaseRepository(
    private val api: RetoureApi,
    private val tokenStore: TokenStore,
) {
    suspend fun lookup(query: String): Result<LookupResponse> = runCatching {
        api.lookupCases(query)
    }

    suspend fun getCase(id: String): Result<CaseDetail> = runCatching {
        api.getCase(id)
    }

    suspend fun receiveCase(caseId: String): Result<Unit> = runCatching {
        val pdaId = tokenStore.getPdaId() ?: "unknown"
        api.receiveCase(caseId, ReceiveRequest(pdaId = pdaId))
        Unit
    }

    suspend fun scanItem(
        caseId: String,
        itemId: String,
        present: Boolean,
    ): Result<Unit> = runCatching {
        val pdaId = tokenStore.getPdaId() ?: "unknown"
        api.scanItem(caseId, itemId, ScanRequest(present = present, pdaId = pdaId))
        Unit
    }

    suspend fun assessItem(
        caseId: String,
        itemId: String,
        score: Int,
        reason: String?,
    ): Result<Unit> = runCatching {
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

    suspend fun finalizeCase(caseId: String): Result<Unit> = runCatching {
        val pdaId = tokenStore.getPdaId() ?: "unknown"
        api.finalizeCase(caseId, FinalizeRequest(pdaId = pdaId))
        Unit
    }

    suspend fun getSuppliers(): Result<List<SupplierDto>> = runCatching {
        api.getSuppliers().suppliers
    }
}
