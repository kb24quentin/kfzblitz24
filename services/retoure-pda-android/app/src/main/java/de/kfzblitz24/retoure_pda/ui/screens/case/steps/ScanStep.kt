package de.kfzblitz24.retoure_pda.ui.screens.case.steps

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.kfzblitz24.retoure_pda.data.api.dto.CaseDetail
import de.kfzblitz24.retoure_pda.data.api.dto.PdaItem
import de.kfzblitz24.retoure_pda.data.api.dto.ScanEanResponse
import de.kfzblitz24.retoure_pda.data.scanner.BarcodeScanner

/**
 * Wareneingang — Scan-zentrierte UX.
 *
 * Worker hat das Paket geöffnet, sieht oben den Prompt "Scanne nun alle
 * Artikel", scannt mit dem Q900. Das System klassifiziert serverseitig
 * und antwortet mit einem von drei Outcomes (ScanEanResponse.kind):
 *
 *   - ok_registered  → Artikel war angemeldet → GROßES GRÜNES "OK"
 *   - ok_extra       → Artikel war in der Order aber nicht angemeldet
 *                       → GROßES GRÜNES "OK BONUS"
 *   - not_ok_unknown → Artikel war NICHT in der Order (Fehlsendung)
 *                       → GROßES ROTES "NOT OK", wandert auf die
 *                         kfzBlitz24-Retoure-Sammel-Palette
 *
 * Fallback: wenn EAN nicht funktioniert (kein Code drauf, Webisco kennt
 * den Artikel nicht), gibt's einen Klein-Button "Manuell bestätigen" der
 * die alte Da/Fehlt-Liste öffnet.
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
) {
    val total = caseDetail.items.size
    val confirmedRegistered = caseDetail.items.count {
        it.source == "registered" && it.status != "pending" && it.status != "missing"
    }
    val extras = caseDetail.items.count { it.source == "extra" }
    val unknowns = caseDetail.items.count { it.source == "unknown" }
    val pending = caseDetail.items.filter { it.source == "registered" && it.status == "pending" }

    // Scanner-Lifecycle: registriert den Broadcast-Receiver für Q900-
    // Hardware-Scans nur während ScanStep sichtbar ist. OHNE diesen
    // DisposableEffect kommt KEIN Scan beim Subscribe-Flow unten an —
    // war der Bug warum scan-ean nie aufgerufen wurde.
    DisposableEffect(Unit) {
        scanner.startListening()
        onDispose { scanner.stopListening() }
    }

    // Hardware-Scanner-Subscription: jeden Scan an scanEan(ean) durchreichen.
    LaunchedEffect(caseDetail.id) {
        scanner.scans.collect { raw ->
            val code = raw.trim()
            if (code.isEmpty()) return@collect
            onScanEan(code)
        }
    }

    // Manuelle Eingabe (Fallback wenn EAN nicht lesbar / kein Barcode)
    var manualMode by remember { mutableStateOf(false) }
    var manualInput by remember { mutableStateOf("") }
    var showManualList by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {

        // ── PROMPT (groß, klar) ───────────────────────────────────────
        Text(
            "Scanne nun alle Artikel",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
        )
        Text(
            "Q900-Scanner an den Artikel-Barcode halten und triggern.",
            color = Color.White.copy(alpha = 0.65f),
            fontSize = 13.sp,
        )

        // ── BIG RESULT CARD ──────────────────────────────────────────
        lastScanResult?.let { result ->
            BigScanResultCard(result = result, onDismiss = onClearLastScan)
        }

        // ── COUNTER-ZEILE ────────────────────────────────────────────
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

        // ── PENDING-Liste (klein, als Erinnerung) ────────────────────
        if (pending.isNotEmpty()) {
            Spacer(Modifier.height(8.dp))
            Text(
                "Noch zu scannen (${pending.size})",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White.copy(alpha = 0.6f),
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

        // ── FALSCHE Items (rot, prominent) ───────────────────────────
        val wrongItems = caseDetail.items.filter { it.source == "unknown" }
        if (wrongItems.isNotEmpty()) {
            Spacer(Modifier.height(8.dp))
            Text(
                "FALSCH-SENDUNGEN (${wrongItems.size})",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFEF9A9A),
                letterSpacing = 0.8.sp,
            )
            Text(
                "→ landen automatisch auf der kfzBlitz24-Retoure-Palette",
                color = Color.White.copy(alpha = 0.5f),
                fontSize = 11.sp,
            )
            wrongItems.forEach { item -> WrongItemRow(item = item) }
        }

        // ── MANUELL-FALLBACK ─────────────────────────────────────────
        Spacer(Modifier.height(12.dp))
        Text(
            "FALLBACK (wenn EAN nicht geht)",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White.copy(alpha = 0.5f),
            letterSpacing = 0.8.sp,
        )

        if (manualMode) {
            Text(
                "EAN/Code manuell eingeben:",
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 12.sp,
            )
            TextField(
                value = manualInput,
                onValueChange = { manualInput = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text("z. B. 4007643456789", color = Color.White.copy(alpha = 0.4f)) },
                colors = TextFieldDefaults.colors(
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedContainerColor = Color.White.copy(alpha = 0.08f),
                    unfocusedContainerColor = Color.White.copy(alpha = 0.08f),
                ),
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
            OutlinedButton(
                onClick = { manualMode = true },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                enabled = !actionLoading,
            ) {
                Text("⌨ EAN manuell eingeben", color = Color.White)
            }
        }

        // Alte Liste mit Da/Fehlt — nur wenn User explizit aufklappt.
        if (pending.isNotEmpty()) {
            OutlinedButton(
                onClick = { showManualList = !showManualList },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                enabled = !actionLoading,
            ) {
                Text(
                    if (showManualList) "Manuell-Liste schließen"
                    else "✋ Liste anzeigen (Da/Fehlt-Buttons)",
                    color = Color.White,
                )
            }
        }
        if (showManualList) {
            pending.forEach { item ->
                ManualConfirmRow(
                    item = item,
                    actionLoading = actionLoading,
                    onMarkPresent = { onScanItem(item.id, true) },
                    onMarkMissing = { onScanItem(item.id, false) },
                )
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────
// Big Result Card — die GROßE Anzeige nach jedem Scan
// ─────────────────────────────────────────────────────────────────────

@Composable
private fun BigScanResultCard(
    result: ScanEanResponse,
    onDismiss: () -> Unit,
) {
    val isOk = result.kind == "ok_registered" || result.kind == "ok_extra"
    val containerColor = if (isOk) Color(0xFF1B5E20) else Color(0xFFB71C1C)
    val border = if (isOk) Color(0xFF66BB6A) else Color(0xFFEF5350)
    val titleText = when (result.kind) {
        "ok_registered" -> "OK"
        "ok_extra"      -> "OK · BONUS"
        "not_ok_unknown" -> "NOT OK"
        else             -> result.kind.uppercase()
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(containerColor)
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            titleText,
            color = Color.White,
            fontSize = 56.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
        )
        Text(
            result.message,
            color = Color.White.copy(alpha = 0.95f),
            fontSize = 15.sp,
            textAlign = TextAlign.Center,
        )

        // Artikel-Info (vor allem für NOT-OK damit User sieht was es war)
        val displayName = result.item?.beschreibung
            ?: result.resolvedArticle?.beschreibung
            ?: result.item?.artikelnummer
            ?: result.resolvedArticle?.artikelnummer
            ?: result.scannedEan
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
        Text(
            "EAN: ${result.scannedEan}",
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 12.sp,
            fontFamily = FontFamily.Monospace,
        )

        Spacer(Modifier.height(4.dp))
        OutlinedButton(
            onClick = onDismiss,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp),
        ) {
            Text("Weiter scannen", color = Color.White, fontWeight = FontWeight.SemiBold)
        }
    }
    // Border-Hint via Spacer-Trick um Material3-Border-Modifier zu sparen:
    // wir zeichnen einfach eine dünne Linie unten drunter.
    Spacer(
        modifier = Modifier
            .fillMaxWidth()
            .height(2.dp)
            .background(border),
    )
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

@Composable
private fun WrongItemRow(item: PdaItem) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0x33C62828))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            item.beschreibung ?: item.artikelnummer ?: "Unbekannt",
            color = Color(0xFFFFCDD2),
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
        )
        item.hersteller?.let { h ->
            Text(h, color = Color.White.copy(alpha = 0.6f), fontSize = 11.sp)
        }
        item.eanCode?.let { ean ->
            Text(
                "EAN $ean",
                color = Color.White.copy(alpha = 0.55f),
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
            )
        }
    }
}

@Composable
private fun ManualConfirmRow(
    item: PdaItem,
    actionLoading: Boolean,
    onMarkPresent: () -> Unit,
    onMarkMissing: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color.White.copy(alpha = 0.06f))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            "${item.menge}× ${item.beschreibung ?: "—"}",
            color = Color.White,
            fontWeight = FontWeight.Medium,
            fontSize = 14.sp,
        )
        item.artikelnummer?.let {
            Text(it, color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp, fontFamily = FontFamily.Monospace)
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Button(
                onClick = onMarkPresent,
                enabled = !actionLoading,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF2E7D32),
                    contentColor = Color.White,
                ),
                shape = RoundedCornerShape(10.dp),
            ) {
                Text("✓ Da", fontWeight = FontWeight.Bold)
            }
            Button(
                onClick = onMarkMissing,
                enabled = !actionLoading,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFC62828),
                    contentColor = Color.White,
                ),
                shape = RoundedCornerShape(10.dp),
            ) {
                Text("✗ Fehlt", fontWeight = FontWeight.Bold)
            }
        }
    }
}
