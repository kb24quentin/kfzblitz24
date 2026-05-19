package de.kfzblitz24.retoure_pda.ui.screens.case.steps

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import de.kfzblitz24.retoure_pda.ui.theme.Orange

/**
 * Wareneingang — manuelle Item-Bestätigung.
 *
 * Bewusst KEIN Scan-Input für die erwarteten Items: der Mitarbeiter
 * hat das Paket vor sich, sieht was angemeldet war, klickt pro Artikel
 * entweder ✓ Da oder ✗ Fehlt. Der `scanner`-Parameter bleibt im
 * Signature für später (z. B. um Extras via Q900 zu scannen), wird in
 * diesem Step aber nicht aktiv genutzt.
 *
 * Unten ggf.:
 *   - "+ Extra-Artikel aus Bestellung" — Webisco-Picker für Artikel
 *     die der Kunde nicht in die RMA aufgenommen hat, aber im Paket
 *     mit zurückkommen (kommt in Folge-Iteration).
 *   - "+ Unbekannten Artikel scannen" — barcode scan + Webisco-
 *     Artikelanfrage (kommt in Folge-Iteration).
 */
@Composable
fun ScanStep(
    caseDetail: CaseDetail,
    @Suppress("UNUSED_PARAMETER") scanner: BarcodeScanner,
    actionLoading: Boolean,
    onScanItem: (itemId: String, present: Boolean) -> Unit,
    onAddExtraFromOrder: () -> Unit = {},
    onAddUnknownByScan: () -> Unit = {},
) {
    val pending = caseDetail.items.filter { it.status == "pending" }
    val total = caseDetail.items.size
    val erfasst = caseDetail.items.count { it.status != "pending" && it.status != "missing" }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "Eingegangene Artikel bestätigen",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
        )
        Text(
            "$erfasst von $total bestätigt · noch ${pending.size} offen",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 13.sp,
        )

        // ── Erwartete Items: Da / Fehlt ────────────────────────────────
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
                    onMarkPresent = { onScanItem(item.id, true) },
                    onMarkMissing = { onScanItem(item.id, false) },
                )
            }
        }

        // ── Bereits bestätigte Items (kompakter Anzeige) ───────────────
        val confirmed = caseDetail.items.filter {
            it.status != "pending" && it.status != "missing"
        }
        if (confirmed.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            Text(
                "ERFASST (${confirmed.size})",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White.copy(alpha = 0.5f),
                letterSpacing = 0.8.sp,
            )
            confirmed.forEach { item -> ConfirmedItemRow(item = item) }
        }

        val missing = caseDetail.items.filter { it.status == "missing" }
        if (missing.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            Text(
                "FEHLT (${missing.size})",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFFEF9A9A),
                letterSpacing = 0.8.sp,
            )
            missing.forEach { item ->
                ConfirmedItemRow(item = item, missing = true)
            }
        }

        // ── Zusätzliche Artikel hinzufügen ─────────────────────────────
        Spacer(Modifier.height(8.dp))
        Text(
            "ARTIKEL HINZUFÜGEN",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White.copy(alpha = 0.5f),
            letterSpacing = 0.8.sp,
        )

        OutlinedButton(
            onClick = onAddExtraFromOrder,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp),
            enabled = !actionLoading,
        ) {
            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.Start) {
                Text(
                    "+ Artikel aus Bestellung (Webisco)",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "War im Auftrag, aber nicht in der RMA",
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 11.sp,
                )
            }
        }

        OutlinedButton(
            onClick = onAddUnknownByScan,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp),
            enabled = !actionLoading,
        ) {
            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.Start) {
                Text(
                    "+ Unbekannten Artikel scannen",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "Nicht im Auftrag — Artikelnummer scannen",
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 11.sp,
                )
            }
        }
    }
}

@Composable
private fun PendingItemRow(
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
        Column {
            Text(
                "${item.menge}× ${item.beschreibung ?: "—"}",
                color = Color.White,
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp,
            )
            item.artikelnummer?.let {
                Text(
                    it,
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                )
            }
            item.hersteller?.let { h ->
                Text(h, color = Color.White.copy(alpha = 0.4f), fontSize = 11.sp)
            }
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
                shape = RoundedCornerShape(8.dp),
            ) {
                Text("✓ Da", fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }
            Button(
                onClick = onMarkMissing,
                enabled = !actionLoading,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0x4DC62828),
                    contentColor = Color(0xFFEF9A9A),
                ),
                shape = RoundedCornerShape(8.dp),
            ) {
                Text("✗ Fehlt", fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun ConfirmedItemRow(item: PdaItem, missing: Boolean = false) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(
                if (missing) Color(0x1FF44336)
                else Color.White.copy(alpha = 0.04f)
            )
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            if (missing) "✗" else "✓",
            color = if (missing) Color(0xFFEF9A9A) else Color(0xFF66BB6A),
            fontSize = 14.sp,
            modifier = Modifier.padding(end = 8.dp),
            fontWeight = FontWeight.Bold,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "${item.menge}× ${item.beschreibung ?: "—"}",
                color = Color.White.copy(alpha = if (missing) 0.65f else 0.85f),
                fontSize = 13.sp,
            )
            item.artikelnummer?.let {
                Text(
                    it,
                    color = Color.White.copy(alpha = 0.4f),
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                )
            }
        }
        if (item.source == "extra" || item.source == "unknown") {
            Text(
                item.source.uppercase(),
                color = Orange,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(Orange.copy(alpha = 0.15f))
                    .padding(horizontal = 6.dp, vertical = 2.dp),
            )
        }
    }
}
