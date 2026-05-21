package de.kfzblitz24.retoure_pda.ui.screens.case.steps

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.kfzblitz24.retoure_pda.data.api.dto.CaseDetail
import de.kfzblitz24.retoure_pda.data.api.dto.PdaItem
import de.kfzblitz24.retoure_pda.data.api.dto.ScanEanResponse
import de.kfzblitz24.retoure_pda.data.scanner.BarcodeScanner
import de.kfzblitz24.retoure_pda.ui.components.AssessForm
import de.kfzblitz24.retoure_pda.ui.components.BigButton
import de.kfzblitz24.retoure_pda.ui.theme.Orange

/**
 * Wareneingang — Scan + Inline-Rating pro Artikel.
 *
 * Flow:
 *   1. Scanne den nächsten Artikel (Q900-Broadcast).
 *   2. Server klassifiziert (registered / extra / unknown).
 *   3. UI zeigt ORANGE "OK"-Card mit Artikel-Info (uniform — keine
 *      grün/rot-Differenzierung im Feedback selbst). Klassifikation
 *      gibt's später im Counter und im Listenbereich.
 *   4. Wenn Artikel rateable (registered/extra, fully scanned):
 *      → Inline-Rating direkt darunter (5 Yes/No-Fragen + Score).
 *      Worker beantwortet, tappt Speichern → Rating wird gespeichert,
 *      OK-Card verschwindet, zurück zur Scan-Aufforderung.
 *   5. Wenn Artikel Falschsendung (source="unknown"):
 *      → keine Bewertung. "Weiter scannen"-Button räumt die Card ab.
 *   6. Wenn Artikel teil-gescannt (z. B. 2 von 6 bei menge=6):
 *      → "x/menge" Anzeige + "Weiter scannen"-Button.
 *   7. "✓ Fertig mit Scannen" wenn alles erfasst.
 */
@Composable
fun ScanStep(
    caseDetail: CaseDetail,
    scanner: BarcodeScanner,
    actionLoading: Boolean,
    lastScanResult: ScanEanResponse?,
    onScanEan: (ean: String) -> Unit,
    onClearLastScan: () -> Unit,
    onScanItem: (itemId: String, present: Boolean) -> Unit,
    onAssessItem: (itemId: String, score: Int, reason: String?) -> Unit,
    onCompleteScanStep: () -> Unit,
) {
    val total = caseDetail.items.size
    val confirmedRegistered = caseDetail.items.count {
        it.source == "registered" && it.status != "pending" && it.status != "missing"
    }
    val extras = caseDetail.items.count { it.source == "extra" }
    val unknowns = caseDetail.items.count { it.source == "unknown" }
    val pending = caseDetail.items.filter { it.source == "registered" && it.status == "pending" }

    // Scanner-Lifecycle: Q900-Broadcasts kommen nur an wenn registriert.
    DisposableEffect(Unit) {
        scanner.startListening()
        onDispose { scanner.stopListening() }
    }

    // Scanner-Subscription → an Backend weiterreichen, ABER nur wenn
    // wir nicht gerade auf eine Bewertung warten. Sobald ein Item
    // gescannt ist und der Worker noch nicht "Speichern + nächster
    // Artikel" geklickt hat (= lastScanResult != null UND das Item
    // ist rateable), schlucken wir weitere Scans still. Sonst würde
    // ein zweiter Scan die Rating-Eingaben überschreiben.
    //
    // Partial-Scans (menge>1, status=pending) und Falschsendungen
    // (source=unknown) brauchen kein Rating → Scans bleiben aktiv,
    // Worker kann sofort den nächsten EAN halten.
    val ratingBlocksScanner = lastScanResult?.let { r ->
        r.item != null &&
            r.item.source != "unknown" &&
            r.item.status == "received"
    } ?: false
    LaunchedEffect(caseDetail.id, ratingBlocksScanner) {
        if (ratingBlocksScanner) return@LaunchedEffect
        scanner.scans.collect { raw ->
            val code = raw.trim()
            if (code.isEmpty()) return@collect
            onScanEan(code)
        }
    }

    // Manuelle EAN-Eingabe (Fallback) — default versteckt.
    var manualMode by remember { mutableStateOf(false) }
    var manualInput by remember { mutableStateOf("") }

    // Rating-Antworten + Notiz pro Item — Reset beim Item-Wechsel.
    val currentItemId = lastScanResult?.item?.id
    var ratingAnswers by remember(currentItemId) { mutableStateOf<Map<String, Boolean>>(emptyMap()) }
    var ratingReason by remember(currentItemId) { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // ── COUNTER-TILES ───────────────────────────────────────────
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            CounterTile(
                label = "Angemeldet",
                value = "$confirmedRegistered/${total - extras - unknowns}",
                color = Color(0xFF2E7D32),
                modifier = Modifier.weight(1f),
            )
            if (extras > 0) {
                CounterTile(
                    label = "Bonus",
                    value = "$extras",
                    color = Color(0xFF1976D2),
                    modifier = Modifier.weight(1f),
                )
            }
            if (unknowns > 0) {
                CounterTile(
                    label = "FALSCH",
                    value = "$unknowns",
                    color = Color(0xFFC62828),
                    modifier = Modifier.weight(1f),
                )
            }
        }

        if (lastScanResult == null) {
            // ── IDLE: Aufforderung zu scannen ────────────────────────
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White.copy(alpha = 0.05f))
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    "Scanne nun den nächsten Artikel",
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                )
                Text(
                    "Scanner an den EAN-Barcode halten.",
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                )
            }

            // Pending-Übersicht (klein)
            if (pending.isNotEmpty()) {
                Text(
                    "OFFEN (${pending.size})",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White.copy(alpha = 0.5f),
                    letterSpacing = 0.8.sp,
                )
                pending.take(5).forEach { item -> PendingItemMini(item = item) }
                if (pending.size > 5) {
                    Text(
                        "… und ${pending.size - 5} weitere",
                        color = Color.White.copy(alpha = 0.4f),
                        fontSize = 12.sp,
                    )
                }
            }
        } else {
            // ── ORANGE OK-Card (uniform für alle Scans) ──────────────
            UniformOkCard(result = lastScanResult)

            val item = lastScanResult.item
            val needsRating = item != null &&
                item.source != "unknown" &&
                item.status == "received"
            val isUnknown = item?.source == "unknown"
            val isPartial = item != null && item.status == "pending" // menge>1 teil-gescannt

            when {
                needsRating -> {
                    // ── Inline-Rating direkt nach dem Scan ───────────
                    Text(
                        "Bewerten — ${item!!.beschreibung ?: item.artikelnummer ?: "Artikel"}",
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "Scanner pausiert — bitte erst Bewertung speichern, dann " +
                            "kommt der nächste Artikel.",
                        color = Color(0xFFFFE082),
                        fontSize = 12.sp,
                    )
                    AssessForm(
                        answers = ratingAnswers,
                        onAnswer = { k, v ->
                            ratingAnswers = ratingAnswers + (k to v)
                        },
                        reason = ratingReason,
                        onReasonChange = { ratingReason = it },
                        actionLoading = actionLoading,
                        onSave = { score, reason ->
                            onAssessItem(item.id, score, reason)
                            onClearLastScan()
                            ratingAnswers = emptyMap()
                            ratingReason = ""
                        },
                        saveButtonText = "Speichern + nächster Artikel",
                    )
                }
                isUnknown -> {
                    // ── Falschsendung: kein Rating, nur weiter ───────
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0x33C62828))
                            .padding(12.dp),
                    ) {
                        Text(
                            "Falschsendung — keine Bewertung erforderlich. " +
                                "Geht automatisch auf die kfzBlitz24-Retoure-Palette.",
                            color = Color(0xFFFFCDD2),
                            fontSize = 13.sp,
                        )
                    }
                    BigButton(
                        text = "Weiter scannen",
                        onClick = { onClearLastScan() },
                    )
                }
                isPartial -> {
                    // ── Teil-Scan bei menge>1 ─────────────────────────
                    Text(
                        "Noch nicht alle Stück gescannt (${item!!.scanCount ?: "?"}/${item.menge}). " +
                            "Weiter scannen für nächstes Stück.",
                        color = Color.White.copy(alpha = 0.75f),
                        fontSize = 13.sp,
                    )
                    BigButton(
                        text = "Weiter scannen",
                        onClick = { onClearLastScan() },
                    )
                }
                else -> {
                    BigButton(
                        text = "Weiter scannen",
                        onClick = { onClearLastScan() },
                    )
                }
            }
        }

        // ── "FERTIG MIT SCANNEN"-Button (immer sichtbar wenn idle) ──
        if (lastScanResult == null) {
            Spacer(Modifier.height(8.dp))
            val hasPending = pending.isNotEmpty()
            if (hasPending) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0x33FFAB00))
                        .padding(10.dp),
                ) {
                    Text(
                        "⚠ Noch ${pending.size} angemeldete Artikel nicht gescannt. " +
                            "Wenn du jetzt 'Fertig' tippst, gelten sie als FEHLEND.",
                        color = Color(0xFFFFE082),
                        fontSize = 13.sp,
                    )
                }
            }
            Button(
                onClick = {
                    pending.forEach { p -> onScanItem(p.id, false) }
                    onCompleteScanStep()
                },
                enabled = !actionLoading,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(72.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF2E7D32),
                    contentColor = Color.White,
                ),
            ) {
                Text(
                    "✓ FERTIG MIT SCANNEN",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                )
            }

            // ── Manueller EAN-Fallback (default versteckt) ────────
            if (manualMode) {
                OutlinedTextField(
                    value = manualInput,
                    onValueChange = { manualInput = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("EAN manuell eintippen", color = Color.White.copy(alpha = 0.4f)) },
                    singleLine = true,
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                        keyboardType = KeyboardType.Number,
                        imeAction = ImeAction.Done,
                    ),
                    keyboardActions = androidx.compose.foundation.text.KeyboardActions(
                        onDone = {
                            if (manualInput.isNotBlank()) {
                                onScanEan(manualInput.trim())
                                manualInput = ""
                                manualMode = false
                            }
                        },
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Orange,
                        unfocusedBorderColor = Orange.copy(alpha = 0.4f),
                        cursorColor = Orange,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                    ),
                    shape = RoundedCornerShape(10.dp),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            if (manualInput.isNotBlank()) {
                                onScanEan(manualInput.trim())
                                manualInput = ""
                                manualMode = false
                            }
                        },
                        enabled = !actionLoading && manualInput.isNotBlank(),
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Text("Senden")
                    }
                    OutlinedButton(
                        onClick = { manualMode = false; manualInput = "" },
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Text("Abbrechen", color = Color.White)
                    }
                }
            } else {
                TextButton(
                    onClick = { manualMode = true },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        "⌨ EAN manuell eingeben",
                        color = Color.White.copy(alpha = 0.5f),
                        fontSize = 12.sp,
                    )
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────
// Uniform Orange OK-Card — egal ob registered/extra/unknown.
// Klassifikation steht klein darunter, dominantes Feedback ist nur
// "system hat den Scan registriert".
// ─────────────────────────────────────────────────────────────────────

@Composable
private fun UniformOkCard(result: ScanEanResponse) {
    val displayName = result.item?.beschreibung
        ?: result.resolvedArticle?.beschreibung
        ?: result.item?.artikelnummer
        ?: result.resolvedArticle?.artikelnummer
        ?: result.scannedEan

    // Klein-Tag rechts oben in der Card: was ist das?
    val classification = when (result.kind) {
        "ok_registered"  -> if (result.item?.menge != null && result.item.menge > 1 && (result.item.scanCount ?: 0) < result.item.menge)
            "${result.item.scanCount ?: 0}/${result.item.menge} angemeldet"
        else "Angemeldet"
        "ok_extra"       -> "Bonus (in Order)"
        "not_ok_unknown" -> "Falschsendung"
        else             -> ""
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Orange)
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            "OK",
            color = Color.White,
            fontSize = 64.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
        )
        Text(
            displayName,
            color = Color.White,
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
        )
        result.item?.hersteller?.let { h ->
            Text(h, color = Color.White.copy(alpha = 0.85f), fontSize = 13.sp)
        }
        if (classification.isNotEmpty()) {
            Text(
                classification,
                color = Color.White.copy(alpha = 0.9f),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Text(
            "EAN ${result.scannedEan}",
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
        )
    }
}

@Composable
private fun CounterTile(
    label: String,
    value: String,
    color: Color,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(color.copy(alpha = 0.25f))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            label,
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.5.sp,
        )
        Text(
            value,
            color = Color.White,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun PendingItemMini(item: PdaItem) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color.White.copy(alpha = 0.05f))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "${item.menge}× ${item.beschreibung ?: item.artikelnummer ?: "—"}",
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 13.sp,
            )
            if (!item.eanCode.isNullOrBlank()) {
                Text(
                    "EAN ${item.eanCode}",
                    color = Color(0xFF81D4FA),
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                )
            } else {
                Text(
                    "ohne EAN — nur manuell bestätigbar",
                    color = Color.White.copy(alpha = 0.45f),
                    fontSize = 11.sp,
                )
            }
        }
    }
}
