package de.kfzblitz24.retoure_pda.data.api

import de.kfzblitz24.retoure_pda.data.api.dto.*
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.http.*

/**
 * Retrofit-Interface gegen /api/pda/*
 *
 * Endpunkte spiegeln exakt die Next.js Route-Handler unter
 * services/retoure/src/app/api/pda/
 *
 * Auth: Bearer-Token (per OkHttp-Interceptor im ApiClient injiziert).
 * Base-URL: konfigurierbar über TokenStore, wird beim Start in ApiClient
 * gesetzt und bei URL-Änderung im SettingsScreen neu aufgebaut.
 */
interface RetoureApi {

    // ── Pairing ──────────────────────────────────────────────────────────────

    @POST("api/pda/pair")
    suspend fun pair(
        @Body body: PairRequest,
    ): PairResponse

    // ── Cases ─────────────────────────────────────────────────────────────────

    /**
     * Suche nach Bestellnummer oder RMA-Code.
     * Query-Param: `q` (Bestellnummer-Fragment oder Belegnummer).
     */
    @GET("api/pda/cases/lookup")
    suspend fun lookupCases(
        @Query("q") query: String,
    ): LookupResponse

    @GET("api/pda/cases/{id}")
    suspend fun getCase(
        @Path("id") id: String,
    ): CaseDetail

    @POST("api/pda/cases/{id}/receive")
    suspend fun receiveCase(
        @Path("id") id: String,
        @Body body: ReceiveRequest,
    ): GenericSuccess

    @POST("api/pda/cases/{id}/finalize")
    suspend fun finalizeCase(
        @Path("id") id: String,
        @Body body: FinalizeRequest,
    ): GenericSuccess

    // ── Items ─────────────────────────────────────────────────────────────────

    @POST("api/pda/cases/{caseId}/items/{itemId}/scan")
    suspend fun scanItem(
        @Path("caseId") caseId: String,
        @Path("itemId") itemId: String,
        @Body body: ScanRequest,
    ): GenericSuccess

    @POST("api/pda/cases/{caseId}/items/{itemId}/assess")
    suspend fun assessItem(
        @Path("caseId") caseId: String,
        @Path("itemId") itemId: String,
        @Body body: AssessRequest,
    ): GenericSuccess

    // ── Photos ────────────────────────────────────────────────────────────────

    @GET("api/pda/cases/{caseId}/items/{itemId}/photos")
    suspend fun getPhotos(
        @Path("caseId") caseId: String,
        @Path("itemId") itemId: String,
    ): PhotoListResponse

    /**
     * Multipart-Upload: fields = file + kind + pdaId
     */
    @Multipart
    @POST("api/pda/cases/{caseId}/items/{itemId}/photos")
    suspend fun uploadPhoto(
        @Path("caseId") caseId: String,
        @Path("itemId") itemId: String,
        @Part file: MultipartBody.Part,
        @Part("kind") kind: RequestBody,
        @Part("pdaId") pdaId: RequestBody,
    ): GenericSuccess

    /**
     * Foto-Download — Coil lädt via OkHttp direkt die URL, aber dieser
     * Endpunkt ist auch als Retrofit-Call verfügbar falls nötig.
     */
    @Streaming
    @GET("api/pda/cases/{caseId}/items/{itemId}/photos/{photoId}/download")
    suspend fun downloadPhoto(
        @Path("caseId") caseId: String,
        @Path("itemId") itemId: String,
        @Path("photoId") photoId: String,
    ): ResponseBody

    // ── Suppliers ─────────────────────────────────────────────────────────────

    @GET("api/pda/suppliers")
    suspend fun getSuppliers(): SuppliersResponse

    // ── Containers ────────────────────────────────────────────────────────────

    @GET("api/pda/containers")
    suspend fun getContainers(
        @Query("status") status: String = "open",
        @Query("supplierId") supplierId: String? = null,
        @Query("limit") limit: Int = 20,
    ): ContainersResponse

    @POST("api/pda/containers")
    suspend fun createContainer(
        @Body body: CreateContainerRequest,
    ): CreateContainerResponse

    @POST("api/pda/containers/{containerId}/items")
    suspend fun addItemToContainer(
        @Path("containerId") containerId: String,
        @Body body: AddItemToContainerRequest,
    ): GenericSuccess
}
