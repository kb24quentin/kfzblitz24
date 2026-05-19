package de.kfzblitz24.retoure_pda.data.api

// Hinweis: Trotz Maven-Coordinates `com.jakewharton.retrofit:retrofit2-kotlinx-
// serialization-converter:1.0.0` liegt die `asConverterFactory`-Extension im
// Paket `retrofit2.converter.kotlinx.serialization`.
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import de.kfzblitz24.retoure_pda.data.auth.TokenStore
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

/**
 * OkHttp + Retrofit Singleton-Factory.
 *
 * Designentscheidung: Das ApiClient-Objekt wird in RetourePdaApp als
 * Singleton angelegt. Wir verwenden KEIN Hilt/Dagger, um den Setup-
 * Aufwand gering zu halten. ViewModels bekommen das ApiClient über
 * den Repo-Konstruktor.
 *
 * Base-URL: Der Interceptor liest die URL bei jedem Request frisch aus
 * TokenStore — dadurch funktioniert die Settings-URL-Änderung, ohne
 * dass der App-Prozess neu gestartet werden muss.
 *
 * Auth: Bearer-Interceptor setzt den Authorization-Header sofern ein
 * Token vorhanden ist. Requests ohne Token (= Pair-Endpoint) schlagen
 * mit 401 fehl, sofern der Server keinen unauthentifizierten Zugriff
 * erlaubt — das ist korrekt und erwünscht.
 */
class ApiClient(private val tokenStore: TokenStore) {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    /** Intercept jede Anfrage und setze Bearer-Token falls vorhanden. */
    private val bearerInterceptor = Interceptor { chain ->
        val token = tokenStore.getToken()
        val request = if (!token.isNullOrEmpty()) {
            chain.request().newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .build()
        } else {
            chain.request()
        }
        chain.proceed(request)
    }

    /**
     * Dynamische Base-URL:
     * Retrofit erwarert eine fixe Base-URL beim Build-Zeitpunkt. Wir
     * lösen das, indem wir ein fake-Basis-Dummy bauen und den Host via
     * OkHttp-Interceptor pro-Request umschreiben.
     *
     * Interceptor liest TokenStore.getBaseUrl() bei jedem Call frisch.
     */
    private val baseUrlInterceptor = Interceptor { chain ->
        val originalRequest = chain.request()
        val baseUrl = tokenStore.getBaseUrl().trimEnd('/')
        val originalUrl = originalRequest.url

        // Nur umschreiben wenn die URL noch auf das Dummy-Placeholder zeigt.
        // In der Praxis: Retrofit baut die URL aus der @GET/@POST-Annotation
        // relativ zu BASE_PLACEHOLDER — wir ersetzen Host + Schema mit
        // der echten gespeicherten URL.
        val newUrl = originalUrl.newBuilder()
            .scheme(if (baseUrl.startsWith("http://")) "http" else "https")
            .host(
                baseUrl
                    .removePrefix("https://")
                    .removePrefix("http://")
                    .split("/")[0]
            )
            .port(
                // Expliziten Port aus der Base-URL verwenden, falls gesetzt
                run {
                    val hostPart = baseUrl
                        .removePrefix("https://")
                        .removePrefix("http://")
                        .split("/")[0]
                    if (hostPart.contains(":")) hostPart.split(":")[1].toIntOrNull() ?: -1
                    else -1
                }
            )
            .build()

        chain.proceed(originalRequest.newBuilder().url(newUrl).build())
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(baseUrlInterceptor)
        .addInterceptor(bearerInterceptor)
        .addInterceptor(loggingInterceptor)   // entfernen für Release
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    // Retrofit benötigt eine statische Base-URL beim Build — wir setzen
    // einen Placeholder; die tatsächliche URL kommt vom baseUrlInterceptor.
    private val retrofit = Retrofit.Builder()
        .baseUrl("https://placeholder.invalid/")   // wird per Interceptor ersetzt
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    val api: RetoureApi = retrofit.create(RetoureApi::class.java)

    /** OkHttp-Client wird auch von Coil für Auth-Header beim Foto-Download genutzt. */
    fun okHttpClient(): OkHttpClient = okHttpClient
}
