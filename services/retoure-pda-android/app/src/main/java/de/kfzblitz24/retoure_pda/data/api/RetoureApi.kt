package de.kfzblitz24.retoure_pda.data.api

import de.kfzblitz24.retoure_pda.data.api.dto.*
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.http.*

/**
 * Retrofit-Interface gegen `/api/pda/...`
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
     * Query-Param: `code` (Bestellnummer-Fragment oder Belegnummer
     * oder gescannter RMA-Code). Backend matched gegen id und gegen
     * bestellnummer. ACHTUNG: nicht `q` — der Endpunkt erwartet `code`,
     * sonst wirft er HTTP 400 "code fehlt".
     */
    @GET("api/pda/cases/lookup")
    suspend fun lookupCases(
        @Query("code") code: String,
        /**
         * Optionales Paket-Label aus dem 2-stufigen Scan-Flow:
         * - Stufe 1: Worker scannt Paket-Label → wir lookup'en das
         * - Stufe 2: Wenn kein Match, Worker scannt Retourenschein →
         *   wir lookup'en die KB-Nummer und hängen das Paket-Label
         *   als customerTrackingNumber an den Case (sofern leer).
         */
        @Query("withTracking") withTracking: String? = null,
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

    /**
     * Scan-EAN-Endpoint — Worker scannt einen Artikel-Barcode mit Q900,
     * Server klassifiziert und reagiert (siehe ScanEanResponse.kind).
     */
    @POST("api/pda/cases/{caseId}/scan-ean")
    suspend fun scanEan(
        @Path("caseId") caseId: String,
        @Body body: ScanEanRequest,
    ): ScanEanResponse

    /**
     * Worker tappt "Fertig mit Scannen" — setzt `scanCompletedAt`, der
     * Wizard advanced damit in den ASSESS-Step.
     */
    @POST("api/pda/cases/{caseId}/scan-complete")
    suspend fun scanComplete(
        @Path("caseId") caseId: String,
        @Body body: ScanCompleteRequest,
    ): GenericSuccess

    /**
     * Hängt ein weiteres Paket-Tracking an die Retoure (Multi-Paket-
     * Szenario). Backend speichert es entweder als customerTracking
     * (wenn noch leer) oder im additionalTrackings-Array.
     */
    @POST("api/pda/cases/{caseId}/add-package")
    suspend fun addPackage(
        @Path("caseId") caseId: String,
        @Body body: AddPackageRequest,
    ): AddPackageResponse

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

    // ── Label-Print ───────────────────────────────────────────────────────────

    /**
     * Holt die Label-Bytes eines Containers als raw byte-Stream.
     *
     * Pfad liegt unter `api/pda/containers/...` (nicht unter `api/admin/...`):
     * Die Middleware in services/retoure/src/middleware.ts blockt auf dem
     * pda.rma.-Host alle Pfade ausser denen unter api/pda/ und api/cron/
     * mit HTTP 404. Wir haben deshalb zwei spiegel-gleiche Endpoints —
     * einen für die Admin-UI und einen für uns.
     *
     * `format` entscheidet welche Druckersprache der Server liefert:
     *   "tspl" — TSC Printer Language (Default für Munbyn-Portables)
     *   "zpl"  — Zebra Programming Language (echte Zebra-Drucker)
     *
     * Achtung beim Editieren: Asterisk-Slash-Sequenzen in KDoc lassen
     * Kotlin denken es seien nested block-comments — deshalb hier KEINE
     * Wildcards mit Slash-Stern schreiben.
     *
     * Body landet direkt in einem `BluetoothSocket.outputStream` → der
     * Drucker rendert was zwischen den Mode-Tokens steht.
     */
    @Streaming
    @GET("api/pda/containers/{containerId}/label-zpl")
    suspend fun getContainerLabelZpl(
        @Path("containerId") containerId: String,
        @Query("format") format: String = "tspl",
    ): ResponseBody

    /**
     * Diagnose-Druck-Endpoint — gleicher Pfad wie das normale Label,
     * aber mit `?test=hello` macht der Server keinen Container-Lookup
     * und liefert ein minimales "TEST kfzBlitz24"-Label.
     */
    @Streaming
    @GET("api/pda/containers/{containerId}/label-zpl")
    suspend fun getContainerLabelTest(
        @Path("containerId") containerId: String,
        @Query("format") format: String = "tspl",
        @Query("test") testMarker: String = "hello",
    ): ResponseBody
}
