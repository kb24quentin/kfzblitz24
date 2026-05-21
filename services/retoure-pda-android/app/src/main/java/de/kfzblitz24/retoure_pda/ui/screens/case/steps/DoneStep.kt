package de.kfzblitz24.retoure_pda.ui.screens.case.steps

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.kfzblitz24.retoure_pda.data.api.dto.CaseDetail
import de.kfzblitz24.retoure_pda.ui.components.BigButton
import de.kfzblitz24.retoure_pda.ui.theme.Orange

@Composable
fun DoneStep(
    caseDetail: CaseDetail,
    actionLoading: Boolean,
    onGoHome: () -> Unit,
) {
    val onPallet = caseDetail.items.filter { it.status == "on_pallet" }
    val missing  = caseDetail.items.filter { it.status == "missing" }
    // Rote Artikel sind palettiert wie alle anderen; der Hinweis hier ist
    // für die Erstattungs-Entscheidung im Back-Office gedacht.
    val redOnPallet = onPallet.filter { it.verdict == "red" }
    val refunded = caseDetail.items.filter { it.status == "refunded" }
    val rejected = caseDetail.items.filter { it.status == "rejected" }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(8.dp))

        Text("✓", fontSize = 56.sp, textAlign = TextAlign.Center)
        Text(
            "Annahme abgeschlossen",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            textAlign = TextAlign.Center,
        )
        Text(
            "${caseDetail.bestellnummer} ist komplett bearbeitet.",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
        )

        // ── Summary ──────────────────────────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White.copy(alpha = 0.06f))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            SummaryRow("Auf Palette",             onPallet.size, SummaryColor.GREEN)
            if (redOnPallet.isNotEmpty()) SummaryRow("davon rot · Erstattung prüfen", redOnPallet.size, SummaryColor.RED)
            if (missing.isNotEmpty())  SummaryRow("Fehlend",                missing.size,  SummaryColor.YELLOW)
            if (refunded.isNotEmpty()) SummaryRow("Bereits erstattet",       refunded.size, SummaryColor.GREEN)
            if (rejected.isNotEmpty()) SummaryRow("Abgelehnt",               rejected.size, SummaryColor.RED)
        }

        // ── Paletten-Übersicht ────────────────────────────────────────
        if (onPallet.isNotEmpty()) {
            val codes = onPallet.mapNotNull { it.containerCode }.distinct()
            Text(
                "PALETTEN",
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White.copy(alpha = 0.5f),
                letterSpacing = 0.8.sp,
            )
            codes.forEach { code ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.White.copy(alpha = 0.06f))
                        .padding(10.dp),
                ) {
                    Text(code, fontFamily = FontFamily.Monospace, color = Color.White, fontSize = 14.sp)
                }
            }
        }

        // Kein "Bestätigungs-Mail an Kunden senden"-Button mehr — der
        // Lager-Mitarbeiter entscheidet das nicht. Die Mail wird vom
        // Admin-Dashboard freigegeben (oder vollautomatisch sobald die
        // Palette an den Lieferanten verschickt wurde).

        BigButton(
            text = "Nächste Annahme",
            onClick = onGoHome,
            enabled = !actionLoading,
            containerColor = Color.White.copy(alpha = 0.12f),
        )
    }
}

private enum class SummaryColor { GREEN, YELLOW, RED }

@Composable
private fun SummaryRow(label: String, count: Int, color: SummaryColor) {
    val dotColor = when (color) {
        SummaryColor.GREEN  -> Color(0xFF69F0AE)
        SummaryColor.YELLOW -> Color(0xFFFFD740)
        SummaryColor.RED    -> Color(0xFFFF5252)
    }
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(dotColor),
            )
            Text(label, color = Color.White.copy(alpha = 0.8f), fontSize = 14.sp)
        }
        Text(
            "$count",
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            fontSize = 15.sp,
        )
    }
}
