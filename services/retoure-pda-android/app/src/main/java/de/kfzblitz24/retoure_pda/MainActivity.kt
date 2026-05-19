package de.kfzblitz24.retoure_pda

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.*
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import de.kfzblitz24.retoure_pda.ui.screens.case.CaseDetailScreen
import de.kfzblitz24.retoure_pda.ui.screens.home.HomeScreen
import de.kfzblitz24.retoure_pda.ui.screens.pair.PairScreen
import de.kfzblitz24.retoure_pda.ui.screens.photos.ItemPhotosScreen
import de.kfzblitz24.retoure_pda.ui.screens.settings.SettingsScreen
import de.kfzblitz24.retoure_pda.ui.theme.RetourePdaTheme

/**
 * Route-Konstanten — zentralisiert damit kein String-Typo in der
 * Navigation passiert.
 */
private object Routes {
    const val PAIR     = "pair"
    const val HOME     = "home"
    const val CASE     = "case/{caseId}"
    const val PHOTOS   = "photos/{caseId}/{itemId}"
    const val SETTINGS = "settings"

    fun case(caseId: String)               = "case/$caseId"
    fun photos(caseId: String, itemId: String) = "photos/$caseId/$itemId"
}

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = applicationContext as RetourePdaApp

        setContent {
            RetourePdaTheme {
                val navController = rememberNavController()

                // Startdestination aus Token-Store ableiten
                val startDest = if (app.tokenStore.hasToken()) Routes.HOME else Routes.PAIR

                NavHost(
                    navController = navController,
                    startDestination = startDest,
                ) {
                    // ── Pair ─────────────────────────────────────────────
                    composable(Routes.PAIR) {
                        PairScreen(
                            pairRepository = app.pairRepository,
                            onPaired = {
                                navController.navigate(Routes.HOME) {
                                    popUpTo(Routes.PAIR) { inclusive = true }
                                }
                            },
                        )
                    }

                    // ── Home ─────────────────────────────────────────────
                    composable(Routes.HOME) {
                        HomeScreen(
                            caseRepository = app.caseRepository,
                            onCaseClick = { caseId ->
                                navController.navigate(Routes.case(caseId))
                            },
                            onSettingsClick = {
                                navController.navigate(Routes.SETTINGS)
                            },
                        )
                    }

                    // ── Case Detail (Wizard) ──────────────────────────────
                    composable(
                        route = Routes.CASE,
                        arguments = listOf(navArgument("caseId") { type = NavType.StringType }),
                    ) { backStackEntry ->
                        val caseId = backStackEntry.arguments?.getString("caseId") ?: return@composable
                        CaseDetailScreen(
                            caseId = caseId,
                            caseRepository = app.caseRepository,
                            containerRepository = app.containerRepository,
                            scanner = app.compositeScanner,
                            onBack = { navController.popBackStack() },
                            onOpenPhotos = { cId, itemId ->
                                navController.navigate(Routes.photos(cId, itemId))
                            },
                        )
                    }

                    // ── Item Photos ───────────────────────────────────────
                    composable(
                        route = Routes.PHOTOS,
                        arguments = listOf(
                            navArgument("caseId") { type = NavType.StringType },
                            navArgument("itemId") { type = NavType.StringType },
                        ),
                    ) { backStackEntry ->
                        val caseId = backStackEntry.arguments?.getString("caseId") ?: return@composable
                        val itemId = backStackEntry.arguments?.getString("itemId") ?: return@composable
                        ItemPhotosScreen(
                            caseId = caseId,
                            itemId = itemId,
                            photoRepository = app.photoRepository,
                            tokenStore = app.tokenStore,
                            onBack = { navController.popBackStack() },
                        )
                    }

                    // ── Settings ──────────────────────────────────────────
                    composable(Routes.SETTINGS) {
                        SettingsScreen(
                            tokenStore = app.tokenStore,
                            onBack = { navController.popBackStack() },
                            onLogout = {
                                navController.navigate(Routes.PAIR) {
                                    popUpTo(0) { inclusive = true }
                                }
                            },
                        )
                    }
                }
            }
        }
    }
}
