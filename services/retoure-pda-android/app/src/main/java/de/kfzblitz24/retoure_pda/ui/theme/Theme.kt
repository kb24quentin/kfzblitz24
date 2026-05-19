package de.kfzblitz24.retoure_pda.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * Dunkles Theme als Default — die PWA nutzt auch ein dunkles Design
 * mit NAVY-Hintergrund und ORANGE als Akzentfarbe.
 *
 * Designentscheidung: Kein Light-Theme. PDA-Mitarbeiter arbeiten
 * im Lager, oft auch bei wechselnden Lichtverhältnissen. Dark-Mode
 * verringert Reflektionen auf PDA-Displays.
 */
private val DarkColorScheme = darkColorScheme(
    primary          = Orange,
    onPrimary        = Color.White,
    primaryContainer = Navy,
    onPrimaryContainer = Color.White,
    secondary        = Navy,
    onSecondary      = Color.White,
    background       = SurfaceDark,
    onBackground     = Color.White,
    surface          = Navy,
    onSurface        = Color.White,
    surfaceVariant   = DarkGrey,
    onSurfaceVariant = White80,
    error            = VerdictRed,
    onError          = Color.White,
    outline          = White40,
)

@Composable
fun RetourePdaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography  = AppTypography,
        content     = content,
    )
}
