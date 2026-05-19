package de.kfzblitz24.retoure_pda.ui.screens.case.steps

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.kfzblitz24.retoure_pda.data.api.dto.CaseDetail
import de.kfzblitz24.retoure_pda.ui.components.BigButton
import de.kfzblitz24.retoure_pda.ui.theme.*

@Composable
fun AssessStep(
    caseId: String,
    caseDetail: CaseDetail,
    actionLoading: Boolean,
    onAssess: (itemId: String, score: Int, reason: String?) -> Unit,
    onOpenPhotos: (caseId: String, itemId: String) -> Unit,
) {
    val queue = caseDetail.items.filter {
        it.status == "received" || it.status == "photographed"
    }
    val current = queue.firstOrNull()
    val completed = caseDetail.items.count { it.status == "assessed" || it.status == "on_pallet" }
    val totalToAssess = queue.size + completed

    var score by remember(current?.id) { mutableIntStateOf(85) }
    var reason by remember(current?.id) { mutableStateOf("") }

    if (current == null) {
        Text(
            "Kein Artikel zu bewerten — weiter zum nächsten Schritt.",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 14.sp,
        )
        return
    }

    val verdictLabel = when {
        score >= 85 -> "GRÜN — Ware OK, Erstattung freigeben"
        score >= 50 -> "GELB — Hersteller-Prüfung nötig"
        else        -> "ROT — Ware kann nicht zurückgenommen werden"
    }
    val verdictColor = when {
        score >= 85 -> VerdictGreen
        score >= 50 -> VerdictYellow
        else        -> VerdictRed
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            "Artikel bewerten",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
        )
        Text(
            "${completed + 1} von $totalToAssess",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 13.sp,
        )

        // Item-Card
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White.copy(alpha = 0.06f))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                "${current.menge}× ${current.beschreibung ?: "—"}",
                fontWeight = FontWeight.SemiBold,
                color = Color.White,
                fontSize = 15.sp,
            )
            val meta = listOfNotNull(current.artikelnummer, current.hersteller).joinToString(" · ")
            if (meta.isNotEmpty()) {
                Text(meta, color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp, fontFamily = FontFamily.Monospace)
            }
            current.grund?.let {
                Text("Retoure-Grund: $it", color = Color.White.copy(alpha = 0.45f), fontSize = 12.sp)
            }

            // Foto-Link
            TextButton(
                onClick = { onOpenPhotos(caseId, current.id) },
                contentPadding = PaddingValues(0.dp),
            ) {
                Text(
                    "📷 Fotos (${current.photoCount})",
                    color = Orange,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        }

        // Score-Anzeige
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(verdictColor)
                .padding(vertical = 14.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "$score/100",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 28.sp,
            )
        }

        // Slider
        Slider(
            value = score.toFloat(),
            onValueChange = { score = it.toInt() },
            valueRange = 0f..100f,
            steps = 99,
            colors = SliderDefaults.colors(
                thumbColor = Orange,
                activeTrackColor = Orange,
                inactiveTrackColor = Color.White.copy(alpha = 0.25f),
            ),
        )

        Text(
            verdictLabel,
            color = Color.White.copy(alpha = 0.85f),
            fontSize = 14.sp,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        )

        // Begründung
        OutlinedTextField(
            value = reason,
            onValueChange = { reason = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = {
                Text(
                    "Begründung (optional, z. B. \"OVP beschädigt\")",
                    color = Color.White.copy(alpha = 0.35f),
                    fontSize = 14.sp,
                )
            },
            minLines = 2,
            maxLines = 4,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Orange,
                unfocusedBorderColor = Color.White.copy(alpha = 0.25f),
                cursorColor = Orange,
            ),
            shape = RoundedCornerShape(10.dp),
        )

        BigButton(
            text = "Speichern + weiter",
            onClick = {
                onAssess(current.id, score, reason.trim().takeIf { it.isNotEmpty() })
            },
            loading = actionLoading,
        )
    }
}
