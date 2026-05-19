package de.kfzblitz24.retoure_pda.data.repo

import de.kfzblitz24.retoure_pda.data.api.RetoureApi
import de.kfzblitz24.retoure_pda.data.api.dto.PhotoDto
import de.kfzblitz24.retoure_pda.data.api.safeApi
import de.kfzblitz24.retoure_pda.data.auth.TokenStore
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

class PhotoRepository(
    private val api: RetoureApi,
    private val tokenStore: TokenStore,
) {
    suspend fun getPhotos(caseId: String, itemId: String): Result<List<PhotoDto>> =
        safeApi("Fotos laden") {
            api.getPhotos(caseId, itemId).photos
        }

    suspend fun uploadPhoto(
        caseId: String,
        itemId: String,
        file: File,
        kind: String,   // "ovp" | "artikel" | "detail1" | "detail2"
    ): Result<Unit> = safeApi("Foto-Upload") {
        val pdaId = tokenStore.getPdaId() ?: "unknown"

        val mimeType = when (file.extension.lowercase()) {
            "jpg", "jpeg" -> "image/jpeg"
            "png"         -> "image/png"
            else          -> "image/jpeg"
        }

        val requestFile = file.asRequestBody(mimeType.toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData("file", file.name, requestFile)
        val kindBody = kind.toRequestBody("text/plain".toMediaTypeOrNull())
        val pdaIdBody = pdaId.toRequestBody("text/plain".toMediaTypeOrNull())

        api.uploadPhoto(caseId, itemId, part, kindBody, pdaIdBody)
        Unit
    }

    /**
     * Baut die Download-URL für ein Foto.
     * Wird von Coil verwendet um Thumbnails mit Auth-Header zu laden.
     * Der OkHttp-Client von ApiClient hat den Bearer-Interceptor bereits.
     */
    fun downloadUrl(
        baseUrl: String,
        caseId: String,
        itemId: String,
        photoId: String,
    ): String {
        val base = baseUrl.trimEnd('/')
        return "$base/api/pda/cases/$caseId/items/$itemId/photos/$photoId/download"
    }
}
