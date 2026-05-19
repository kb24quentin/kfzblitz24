package de.kfzblitz24.retoure_pda

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import de.kfzblitz24.retoure_pda.data.api.ApiClient
import de.kfzblitz24.retoure_pda.data.auth.TokenStore
import de.kfzblitz24.retoure_pda.data.repo.CaseRepository
import de.kfzblitz24.retoure_pda.data.repo.ContainerRepository
import de.kfzblitz24.retoure_pda.data.repo.PairRepository
import de.kfzblitz24.retoure_pda.data.repo.PhotoRepository
import de.kfzblitz24.retoure_pda.data.scanner.CompositeScanner
import de.kfzblitz24.retoure_pda.data.scanner.IntentBroadcastScanner
import de.kfzblitz24.retoure_pda.data.scanner.KeyboardWedgeScanner

/**
 * Application-Klasse — initialisiert alle Singletons.
 *
 * Designentscheidung: kein Hilt/Dagger (würde ~30% mehr Setup-Aufwand
 * bedeuten für diesen Scaffold). Stattdessen manuelle DI via App-
 * Singletons. ViewModels greifen über (applicationContext as RetourePdaApp)
 * auf tokenStore, apiClient etc. zu, oder bekommen sie per Konstruktor
 * von einer ViewModelFactory.
 *
 * Wenn Hilt später nachgerüstet wird:
 *   1. @HiltAndroidApp auf RetourePdaApp
 *   2. @Module + @Provides für TokenStore, ApiClient, Repos
 *   3. @HiltViewModel auf alle ViewModels
 *   4. DI-Referenzen in MainActivity auf @AndroidEntryPoint umstellen
 */
class RetourePdaApp : Application(), ImageLoaderFactory {

    lateinit var tokenStore: TokenStore
        private set

    lateinit var apiClient: ApiClient
        private set

    // Repos
    lateinit var pairRepository: PairRepository
        private set
    lateinit var caseRepository: CaseRepository
        private set
    lateinit var containerRepository: ContainerRepository
        private set
    lateinit var photoRepository: PhotoRepository
        private set

    // Scanner (App-Singleton — Lifecycle in Screen-Composables)
    lateinit var compositeScanner: CompositeScanner
        private set

    override fun onCreate() {
        super.onCreate()

        tokenStore  = TokenStore(this)
        apiClient   = ApiClient(tokenStore)

        pairRepository      = PairRepository(apiClient.api, tokenStore)
        caseRepository      = CaseRepository(apiClient.api, tokenStore)
        containerRepository = ContainerRepository(apiClient.api, tokenStore)
        photoRepository     = PhotoRepository(apiClient.api, tokenStore)

        compositeScanner = CompositeScanner(
            keyboard = KeyboardWedgeScanner(),
            intent   = IntentBroadcastScanner(this),
        )
    }

    /**
     * Coil ImageLoader mit dem Auth-fähigen OkHttp-Client konfigurieren,
     * damit Foto-Thumbnails mit Bearer-Token geladen werden.
     */
    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .okHttpClient(apiClient.okHttpClient())
            .crossfade(true)
            .build()
    }
}
