package de.kfzblitz24.retoure_pda.ui.screens.case.steps

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.kfzblitz24.retoure_pda.data.api.dto.CaseDetail
import de.kfzblitz24.retoure_pda.data.api.dto.ContainerDto
import de.kfzblitz24.retoure_pda.data.api.dto.SupplierDto
import de.kfzblitz24.retoure_pda.data.repo.ContainerRepository
import de.kfzblitz24.retoure_pda.data.scanner.BarcodeScanner
import de.kfzblitz24.retoure_pda.ui.components.BigButton
import de.kfzblitz24.retoure_pda.ui.theme.Orange

/**
 * Palette-Step — System sagt "Lege auf Palette X", Mitarbeiter scannt
 * den Paletten-Code zur Bestätigung.
 *
 * Flow:
 *   1. Supplier bestimmen — bevorzugt `current.supplierId` (vom vorherigen
 *      Item), sonst erster aktiver Supplier (= Default Interparts).
 *   2. Offene Container des Suppliers laden.
 *   3. Wenn ≥ 1 offen: ersten vorschlagen ("Lege auf PAL-INTERP-2026-…")
 *      + Scan-Input für Bestätigung.
 *   4. Wenn keiner offen: Button "+ Neue Palette anlegen", legt an +
 *      bietet direkt den neuen Code zum Scan an.
 *   5. Mitarbeiter scannt mit Q900 → wenn match: link & next.
 *      Wenn nicht: Fehlerton + Hinweis.
 *
 * Optional: "Anderen Lieferanten wählen" als kleiner Link unten —
 * öffnet eine Stufe-2-Auswahl für den (seltenen) Fall.
 */
@Composable
fun PaletteStep(
    caseDetail: CaseDetail,
    suppliers: List<SupplierDto>,
    containerRepository: ContainerRepository,
    scanner: BarcodeScanner,
    actionLoading: Boolean,
    onLinkToContainer: (containerId: String, itemId: String) -> Unit,
    onCreateContainerAndLink: (supplierId: String, itemId: String) -> Unit,
) {
    val queue = caseDetail.items.filter {
        it.status == "assessed" && it.verdict != "red"
    }
    val current = queue.firstOrNull()
    val completed = caseDetail.items.count { it.status == "on_pallet" }
    val totalToPalettize = queue.size + completed

    // Supplier-Default-Logik: bevorzugt der schon am Item gesetzte
    // Supplier (vom vorherigen Auflegen), sonst der erste aktive.
    val defaultSupplierId =
        current?.supplierId ?: suppliers.firstOrNull()?.id
    var selectedSupplierId by remember(current?.id, defaultSupplierId) {
        mutableStateOf(defaultSupplierId)
    }
    var openContainers by remember(selectedSupplierId) {
        mutableStateOf<List<ContainerDto>>(emptyList())
    }
    var loadingContainers by remember { mutableStateOf(false) }

    // Scan-State
    var scanInput by remember(current?.id, openContainers) {
        mutableStateOf("")
    }
    var scanError by remember { mutableStateOf<String?>(null) }
    var showSupplierPicker by remember { mutableStateOf(false) }

    // Offene Container laden wenn Supplier wechselt
    LaunchedEffect(selectedSupplierId) {
        val sid = selectedSupplierId ?: return@LaunchedEffect
        loadingContainers = true
        containerRepository.getOpenContainers(sid)
            .onSuccess { openContainers = it }
            .onFailure { openContainers = emptyList() }
        loadingContainers = false
    }

    if (current == null) {
        Text(
            "Keine Artikel mehr für Paletten — weiter.",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 14.sp,
        )
        return
    }

    // Vorgeschlagener Container = erster offener für diesen Supplier
    val suggestedContainer = openContainers.firstOrNull()
    val chosenSupplier = suppliers.find { it.id == selectedSupplierId }

    // Scanner-Hardware-Trigger speist scanInput
    DisposableEffect(Unit) {
        scanner.startListening()
        onDispose { scanner.stopListening() }
    }
    LaunchedEffect(scanner, suggestedContainer?.id, current.id) {
        scanner.scans.collect { code ->
            val cleaned = code.trim()
            if (cleaned.isEmpty()) return@collect
            scanInput = cleaned
            checkScan(cleaned, suggestedContainer, current.id, onLinkToContainer) { err ->
                scanError = err
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            "Auf Palette legen",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
        )
        Text(
            "${completed + 1} von $totalToPalettize",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 13.sp,
        )

        // ── Artikel-Card ────────────────────────────────────────────
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
            current.verdict?.let { v ->
                val badge = if (v == "green") Color(0x4400C853) else Color(0x44FFAB00)
                val txt = if (v == "green") Color(0xFFB9F6CA) else Color(0xFFFFE082)
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(badge)
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                ) {
                    Text("● $v", color = txt, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        when {
            // ── Keine Lieferanten in DB ─────────────────────────────
            suppliers.isEmpty() -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0x22FFAB00))
                        .padding(12.dp),
                ) {
                    Text(
                        "Keine Lieferanten gepflegt — bitte im Admin-Dashboard anlegen.",
                        color = Color(0xFFFFE082),
                        fontSize = 13.sp,
                    )
                }
            }

            // ── Lieferant noch nicht entschieden ────────────────────
            // (sollte selten passieren — Default greift fast immer)
            selectedSupplierId == null || showSupplierPicker -> {
                Text(
                    "An welchen Lieferanten geht der Artikel?",
                    color = Color.White.copy(alpha = 0.75f),
                    fontSize = 14.sp,
                )
                suppliers.forEach { s ->
                    Button(
                        onClick = {
                            selectedSupplierId = s.id
                            showSupplierPicker = false
                        },
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color.White.copy(alpha = 0.1f),
                            contentColor = Color.White,
                        ),
                    ) {
                        Text(s.name, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            loadingContainers -> {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = Orange)
                }
            }

            // ── Keine offene Palette → neue anlegen ─────────────────
            suggestedContainer == null -> {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0x22FFAB00))
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        "Noch keine offene Palette für ${chosenSupplier?.name ?: "diesen Lieferanten"}",
                        color = Color(0xFFFFE082),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        "Lege eine neue Palette an — der Code wird gedruckt (bzw. PDF) " +
                            "und der Artikel direkt drauf gelegt.",
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 12.sp,
                    )
                }
                BigButton(
                    text = if (actionLoading) "Lege an…"
                           else "+ Neue Palette für ${chosenSupplier?.name ?: "Lieferant"}",
                    onClick = { onCreateContainerAndLink(selectedSupplierId!!, current.id) },
                    loading = actionLoading,
                )
            }

            // ── HAUPTPFAD: System sagt + scan bestätigt ─────────────
            else -> {
                // Aufforderung
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Orange.copy(alpha = 0.16f))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        "Lege den Artikel auf",
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 14.sp,
                    )
                    Text(
                        suggestedContainer.code,
                        color = Orange,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    )
                    Text(
                        "(${chosenSupplier?.name ?: "Lieferant"} · " +
                            "${suggestedContainer.itemCount} Artikel bisher drauf)",
                        color = Color.White.copy(alpha = 0.6f),
                        fontSize = 12.sp,
                    )
                }

                // Scan-Aufforderung
                Text(
                    "Scanne den Paletten-Code zur Bestätigung",
                    color = Color.White.copy(alpha = 0.85f),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )

                OutlinedTextField(
                    value = scanInput,
                    onValueChange = {
                        scanInput = it
                        scanError = null
                    },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = {
                        Text(
                            "Q900 auf den Paletten-Aufkleber halten…",
                            color = Color.White.copy(alpha = 0.35f),
                            fontSize = 13.sp,
                        )
                    },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Ascii,
                        imeAction = ImeAction.Done,
                        autoCorrect = false,
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            checkScan(
                                scanInput.trim(),
                                suggestedContainer,
                                current.id,
                                onLinkToContainer,
                            ) { err -> scanError = err }
                        },
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Orange,
                        unfocusedBorderColor = Orange.copy(alpha = 0.5f),
                        cursorColor = Orange,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                    ),
                    shape = RoundedCornerShape(10.dp),
                )

                scanError?.let { err ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0x33F44336))
                            .padding(10.dp),
                    ) {
                        Text(err, color = Color(0xFFEF9A9A), fontSize = 13.sp)
                    }
                }

                // Soft-Action: anderen Lieferant wählen
                TextButton(
                    onClick = { showSupplierPicker = true },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        "Anderer Lieferant?",
                        color = Color.White.copy(alpha = 0.45f),
                        fontSize = 12.sp,
                    )
                }
            }
        }
    }
}

/**
 * Vergleicht den gescannten Code mit dem erwarteten Container-Code.
 * Bei Match: ruft `onLink`. Sonst: setzt Fehler.
 */
private fun checkScan(
    scanned: String,
    expected: ContainerDto?,
    itemId: String,
    onLink: (containerId: String, itemId: String) -> Unit,
    onError: (String) -> Unit,
) {
    val cleaned = scanned.trim()
    if (cleaned.isEmpty() || expected == null) return
    // Case-insensitive Vergleich; PAL-Codes sind groß, aber wer weiß was
    // die Q900-Firmware case-mäßig macht.
    if (cleaned.equals(expected.code, ignoreCase = true)) {
        onLink(expected.id, itemId)
    } else {
        onError(
            "Code passt nicht. Gescannt: \"$cleaned\" · " +
                "Erwartet: \"${expected.code}\""
        )
    }
}
