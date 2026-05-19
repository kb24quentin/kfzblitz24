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
 * 5-Step-Indikator analog zur PWA:
 *   Orange  = aktiver Schritt
 *   Grün    = erledigter Schritt
 *   Grau    = noch nicht dran
 */
@Composable
fun StepProgress(currentStep: WizardStep, modifier: Modifier = Modifier) {
    val steps = WizardStep.entries
    val currentIdx = steps.indexOf(currentStep)

    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        steps.forEachIndexed { index, step ->
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
