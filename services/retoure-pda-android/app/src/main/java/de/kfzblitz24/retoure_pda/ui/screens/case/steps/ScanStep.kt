package de.kfzblitz24.retoure_pda.ui.screens.case.steps

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
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
import de.kfzblitz24.retoure_pda.data.api.dto.PdaItem
import de.kfzblitz24.retoure_pda.data.scanner.BarcodeScanner
import de.kfzblitz24.retoure_pda.ui.components.ScanInputField
import de.kfzblitz24.retoure_pda.ui.theme.Orange

private enum class FeedbackKind { OK, MISS, ERR }
private data class Feedback(val kind: FeedbackKind, val msg: String)

@Composable
fun ScanStep(
    caseDetail: CaseDetail,
    scanner: BarcodeScanner,
    actionLoading: Boolean,
    onScanItem: (itemId: String, present: Boolean) -> Unit,
) {
    val pending = caseDetail.items.filter { it.status == "pending" }
    val total = caseDetail.items.size
    val erfasst = caseDetail.items.count { it.status != "pending" && it.status != "missing" }

    var scanInput by remember { mutableStateOf("") }
    var feedback by remember { mutableStateOf<Feedback?>(null) }

    // Subscribe to scanner broadcasts
    LaunchedEffect(scanner) {
        scanner.scans.collect { code ->
            handleScan(code, caseDetail, onScanItem) { fb ->
                feedback = fb
            }
            scanInput = ""
        }
    }

    // Start/Stop Scanner
    DisposableEffect(Unit) {
        scanner.startListening()
        onDispose { scanner.stopListening() }
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "Artikel scannen",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
        )
        Text(
            "$erfasst von $total erfasst · noch ${pending.size} offen",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 13.sp,
        )

        ScanInputField(
            value = scanInput,
            onValueChange = { scanInput = it; feedback = null },
            onScan = { code ->
                handleScan(code, caseDetail, onScanItem) { fb ->
                    feedback = fb
                }
                scanInput = ""
            },
            enabled = !actionLoading,
        )

        feedback?.let { fb ->
            val (bg, textColor) = when (fb.kind) {
                FeedbackKind.OK   -> Pair(Color(0x2200C853), Color(0xFFB9F6CA))
                FeedbackKind.MISS -> Pair(Color(0x22FFAB00), Color(0xFFFFE082))
                FeedbackKind.ERR  -> Pair(Color(0x22F44336), Color(0xFFEF9A9A))
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(bg)
                    .padding(10.dp),
            ) {
                Text(fb.msg, color = textColor, fontSize = 13.sp)
            }
        }

        // Offene Items-Liste
        if (pending.isNotEmpty()) {
            Text(
                "ERWARTET (${pending.size})",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White.copy(alpha = 0.5f),
                letterSpacing = 0.8.sp,
            )
            pending.forEach { item ->
                PendingItemRow(
                    item = item,
                    actionLoading = actionLoading,
                    onMarkMissing = { onScanItem(item.id, false) },
                )
            }
        }
    }
}

@Composable
private fun PendingItemRow(
    item: PdaItem,
    actionLoading: Boolean,
    onMarkMissing: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color.White.copy(alpha = 0.06f))
            .padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "${item.menge}× ${item.beschreibung ?: "—"}",
                color = Color.White,
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp,
            )
            item.artikelnummer?.let {
                Text(it, color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp, fontFamily = FontFamily.Monospace)
            }
        }
        Button(
            onClick = onMarkMissing,
            enabled = !actionLoading,
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0x4DC62828),
                contentColor = Color(0xFFEF9A9A),
            ),
            shape = RoundedCornerShape(8.dp),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
        ) {
            Text("fehlt", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

private fun handleScan(
    code: String,
    caseDetail: CaseDetail,
    onScanItem: (itemId: String, present: Boolean) -> Unit,
    onFeedback: (Feedback) -> Unit,
) {
    val norm = code.lowercase()
    val candidates = caseDetail.items.filter {
        (it.artikelnummer ?: "").lowercase() == norm
    }
    val target = candidates.firstOrNull { it.status == "pending" } ?: candidates.firstOrNull()

    when {
        target == null -> onFeedback(
            Feedback(FeedbackKind.MISS, "Kein Artikel \"$code\" in diesem Case.")
        )
        target.status == "received" -> onFeedback(
            Feedback(FeedbackKind.OK, "Bereits erfasst: ${target.beschreibung ?: code}")
        )
        else -> {
            onScanItem(target.id, true)
            onFeedback(Feedback(FeedbackKind.OK, "✓ ${target.beschreibung ?: code} erfasst"))
        }
    }
}
