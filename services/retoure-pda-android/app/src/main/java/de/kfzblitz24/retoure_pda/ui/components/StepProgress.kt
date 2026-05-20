package de.kfzblitz24.retoure_pda.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.kfzblitz24.retoure_pda.ui.screens.case.WizardStep
import de.kfzblitz24.retoure_pda.ui.theme.Orange
import de.kfzblitz24.retoure_pda.ui.theme.StepDone
import de.kfzblitz24.retoure_pda.ui.theme.StepInactive

/**
 * Step-Indikator. Seit dem Inline-Rating-Pass sind SCAN + ASSESS
 * konzeptionell EIN Schritt ("Artikel erfassen") — pro Artikel
 * scannen + sofort bewerten. Wir filtern ASSESS aus dem Display
 * und mappen ihn intern auf SCAN für die Aktiv-Markierung.
 *
 *   Orange  = aktiver Schritt
 *   Grün    = erledigter Schritt
 *   Grau    = noch nicht dran
 */
@Composable
fun StepProgress(currentStep: WizardStep, modifier: Modifier = Modifier) {
    // ASSESS aus dem visuellen Display ausblenden — der Worker sieht
    // SCAN und ASSESS als einen einzigen "Artikel erfassen"-Schritt.
    val displaySteps = WizardStep.entries.filter { it != WizardStep.ASSESS }
    // Wenn der echte Step ASSESS ist, behandeln wir ihn fürs Display
    // wie SCAN — gleiche Pill bleibt orange aktiv.
    val effectiveStep = if (currentStep == WizardStep.ASSESS) WizardStep.SCAN
                        else currentStep
    val currentIdx = displaySteps.indexOf(effectiveStep)

    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        displaySteps.forEachIndexed { index, step ->
            val isActive = index == currentIdx
            val isDone   = index < currentIdx

            val bgColor = when {
                isActive -> Orange
                isDone   -> StepDone
                else     -> StepInactive
            }
            val textColor = when {
                isActive -> Color.White
                isDone   -> Color(0xFFB9F6CA)
                else     -> Color.White.copy(alpha = 0.4f)
            }

            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(6.dp))
                    .background(bgColor)
                    .padding(vertical = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "${index + 1}. ${step.label}",
                    color = textColor,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                )
            }
        }
    }
}
