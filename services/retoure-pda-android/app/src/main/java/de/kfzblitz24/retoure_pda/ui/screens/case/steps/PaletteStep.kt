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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.kfzblitz24.retoure_pda.data.api.dto.CaseDetail
import de.kfzblitz24.retoure_pda.data.api.dto.ContainerDto
import de.kfzblitz24.retoure_pda.data.api.dto.PdaItem
import de.kfzblitz24.retoure_pda.data.api.dto.SupplierDto
import de.kfzblitz24.retoure_pda.data.repo.ContainerRepository
import de.kfzblitz24.retoure_pda.data.scanner.BarcodeScanner
import de.kfzblitz24.retoure_pda.ui.components.BigButton
import de.kfzblitz24.retoure_pda.ui.theme.Orange

/**
 * Palette-Step — Zwei-Stufen-Scan-Flow:
 *
 *   STUFE 1 (idle):     Worker scannt EAN eines Artikels → System
 *                       identifiziert Item + zeigt zugehörige Palette
 *                       (basierend auf item.supplierId).
 *   STUFE 2 (selected): Worker scannt Paletten-Code zur Bestätigung
 *                       → Backend verlinkt Item ↔ Container. UI zurück
 *                       in Stufe 1 für den nächsten Artikel.
 *
 * Manuelle Eingabe (Texteingabe) ist standardmässig versteckt —
 * öffnet sich nur wenn der Worker explizit auf "Manuell eingeben"
 * tappt (Fallback wenn ein EAN/Paletten-Code unlesbar ist).
 *
 * Items ohne `eanCode` (Webisco kennt keinen / Sammelartikel) können
 * nicht per Artikel-Scan ausgewählt werden — der Fallback-Button
 * öffnet eine Liste zur manuellen Auswahl.
 *
 * Falschsendungen (source="unknown") haben `supplierId="kfzblitz24-
 * internal"` und landen automatisch auf der "kfzBlitz24 Retoure (intern)"-
 * Palette mit Code-Prefix "KB-" (z. B. "KB-003").
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
    // Queue: Items die noch palettiert werden müssen.
    //   - registrierte+extra Items: status="assessed" + verdict != "red"
    //   - unknown Items: source="unknown" + status="assessed" (vom Scan-Endpoint
    //     auto-assessed) + verdict==null
    val queue = remember(caseDetail.items) {
        caseDetail.items.filter {
            (it.status == "assessed" && it.verdict != "red") ||
                (it.source == "unknown" && it.status == "assessed")
        }
    }
    val completed = caseDetail.items.count { it.status == "on_pallet" }
    val totalToPalettize = queue.size + completed

    // Selected item — Stufe 2 ist aktiv wenn != null.
    var selectedItemId by remember(caseDetail.items) { mutableStateOf<String?>(null) }
    val selectedItem = queue.find { it.id == selectedItemId }

    // Manuelle Modi
    var showManualItemPicker by remember { mutableStateOf(false) }
    var showManualPaletteInput by remember { mutableStateOf(false) }
    var manualPaletteInput by remember(selectedItemId) { mutableStateOf("") }

    // Fehler-Banner (rot, lokal in der UI)
    var scanError by remember { mutableStateOf<String?>(null) }

    // Open containers cache pro Supplier — laden wir lazy wenn ein Item
    // ausgewählt wurde damit wir nicht alle Supplier vorab abfragen.
    var openContainersForItem by remember(selectedItemId) {
        mutableStateOf<List<ContainerDto>?>(null)
    }

    // Lade offene Container sobald ein Item gewählt wurde
    LaunchedEffect(selectedItem?.supplierId) {
        val sid = selectedItem?.supplierId ?: return@LaunchedEffect
        containerRepository.getOpenContainers(sid)
            .onSuccess { openContainersForItem = it }
            .onFailure { openContainersForItem = emptyList() }
    }

    // Scanner-Lifecycle + Subscription
    DisposableEffect(Unit) {
        scanner.startListening()
        onDispose { scanner.stopListening() }
    }
    LaunchedEffect(selectedItemId, openContainersForItem) {
        scanner.scans.collect { raw ->
            val code = raw.trim()
            if (code.isEmpty()) return@collect
            handleScan(
                scannedCode = code,
                selectedItem = selectedItem,
                queue = queue,
                suggestedContainer = openContainersForItem?.firstOrNull(),
                onSelectItem = {
                    selectedItemId = it
                    scanError = null
                },
                onLinkToContainer = onLinkToContainer,
                onError = { msg -> scanError = msg },
            )
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
            "$completed von $totalToPalettize palettiert · ${queue.size} offen",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 13.sp,
        )

        if (queue.isEmpty()) {
            Text(
                "Alle Artikel sind palettiert — Schritt abgeschlossen.",
                color = Color(0xFFB9F6CA),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
            return@Column
        }

        // Fehler-Banner
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

        if (selectedItem == null) {
            // ── STUFE 1: Artikel scannen ────────────────────────────
            Stage1ScanArticle(
                queue = queue,
                onOpenManualPicker = { showManualItemPicker = true },
            )
        } else {
            // ── STUFE 2: Palette scannen ────────────────────────────
            Stage2ScanPalette(
                item = selectedItem,
                supplier = suppliers.find { it.id == selectedItem.supplierId },
                suggestedContainer = openContainersForItem?.firstOrNull(),
                loadingContainers = openContainersForItem == null,
                actionLoading = actionLoading,
                showManualInput = showManualPaletteInput,
                manualInput = manualPaletteInput,
                onManualInputChange = { manualPaletteInput = it },
                onToggleManualInput = { showManualPaletteInput = !showManualPaletteInput },
                onSubmitManualInput = {
                    val expected = openContainersForItem?.firstOrNull()
                    val v = manualPaletteInput.trim()
                    if (v.isNotEmpty() && expected != null && v.equals(expected.code, ignoreCase = true)) {
                        onLinkToContainer(expected.id, selectedItem.id)
                        manualPaletteInput = ""
                        showManualPaletteInput = false
                        selectedItemId = null
                    } else if (expected != null) {
                        scanError = "Code passt nicht. Erwartet: ${expected.code}"
                    }
                },
                onCreateNew = {
                    selectedItem.supplierId?.let { sid ->
                        onCreateContainerAndLink(sid, selectedItem.id)
                        selectedItemId = null
                    }
                },
                onCancel = { selectedItemId = null; scanError = null },
            )
        }

        // ── Manueller Item-Picker (Fallback Stufe 1) ────────────────
        if (showManualItemPicker) {
            ManualItemPicker(
                queue = queue,
                onPick = {
                    selectedItemId = it
                    showManualItemPicker = false
                    scanError = null
                },
                onCancel = { showManualItemPicker = false },
            )
        }
    }
}

@Composable
private fun Stage1ScanArticle(
    queue: List<PdaItem>,
    onOpenManualPicker: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White.copy(alpha = 0.06f))
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            "Scanne den nächsten Artikel",
            color = Color.White,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )
        Text(
            "EAN-Barcode mit Q900 scannen — System sagt dir auf welche Palette.",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
        )
    }

    // Kleiner Queue-Übersicht
    Text(
        "WARTET NOCH (${queue.size})",
        fontSize = 10.sp,
        fontWeight = FontWeight.SemiBold,
        color = Color.White.copy(alpha = 0.5f),
        letterSpacing = 0.8.sp,
    )
    queue.take(8).forEach { item -> QueueItemMini(item = item) }
    if (queue.size > 8) {
        Text(
            "… und ${queue.size - 8} weitere",
            color = Color.White.copy(alpha = 0.4f),
            fontSize = 12.sp,
        )
    }

    // Fallback nur dezent — selten benötigt
    Spacer(Modifier.height(4.dp))
    TextButton(
        onClick = onOpenManualPicker,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(
            "Manuell auswählen (für Artikel ohne EAN)",
            color = Color.White.copy(alpha = 0.5f),
            fontSize = 12.sp,
        )
    }
}

@Composable
private fun Stage2ScanPalette(
    item: PdaItem,
    supplier: SupplierDto?,
    suggestedContainer: ContainerDto?,
    loadingContainers: Boolean,
    actionLoading: Boolean,
    showManualInput: Boolean,
    manualInput: String,
    onManualInputChange: (String) -> Unit,
    onToggleManualInput: () -> Unit,
    onSubmitManualInput: () -> Unit,
    onCreateNew: () -> Unit,
    onCancel: () -> Unit,
) {
    // Artikel-Bestätigung
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0x3300C853))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            "✓ Artikel erkannt",
            color = Color(0xFFB9F6CA),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            item.beschreibung ?: item.artikelnummer ?: "—",
            color = Color.White,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
        )
        val meta = listOfNotNull(item.artikelnummer, item.hersteller).joinToString(" · ")
        if (meta.isNotEmpty()) {
            Text(
                meta,
                color = Color.White.copy(alpha = 0.65f),
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
            )
        }
    }

    when {
        loadingContainers -> {
            Box(modifier = Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Orange)
            }
        }
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
                    "Noch keine offene Palette für ${supplier?.name ?: "diesen Lieferanten"}",
                    color = Color(0xFFFFE082),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            BigButton(
                text = if (actionLoading) "Lege an…"
                       else "+ Neue Palette für ${supplier?.name ?: "Lieferant"}",
                onClick = onCreateNew,
                loading = actionLoading,
            )
        }
        else -> {
            // Aufforderung Palette zu scannen — Code GROSS
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Orange.copy(alpha = 0.16f))
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    "Lege auf Palette",
                    color = Color.White.copy(alpha = 0.85f),
                    fontSize = 14.sp,
                )
                Text(
                    suggestedContainer.code,
                    color = Orange,
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                )
                Text(
                    "→ ${supplier?.name ?: "Lieferant"}",
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 13.sp,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "Scanne den Paletten-Code zur Bestätigung",
                    color = Color.White.copy(alpha = 0.85f),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                )
            }

            // Manuelle Eingabe — default versteckt, nur als Fallback
            if (showManualInput) {
                OutlinedTextField(
                    value = manualInput,
                    onValueChange = onManualInputChange,
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = {
                        Text("Code manuell eintippen…", color = Color.White.copy(alpha = 0.35f))
                    },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Ascii,
                        imeAction = ImeAction.Done,
                        autoCorrect = false,
                    ),
                    keyboardActions = KeyboardActions(onDone = { onSubmitManualInput() }),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Orange,
                        unfocusedBorderColor = Orange.copy(alpha = 0.5f),
                        cursorColor = Orange,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                    ),
                    shape = RoundedCornerShape(10.dp),
                )
                Button(
                    onClick = onSubmitManualInput,
                    enabled = !actionLoading,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Text("Bestätigen", fontWeight = FontWeight.SemiBold)
                }
            } else {
                TextButton(
                    onClick = onToggleManualInput,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        "⌨ Code manuell eingeben",
                        color = Color.White.copy(alpha = 0.5f),
                        fontSize = 12.sp,
                    )
                }
            }
        }
    }

    TextButton(
        onClick = onCancel,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(
            "← Anderen Artikel scannen",
            color = Color.White.copy(alpha = 0.5f),
            fontSize = 12.sp,
        )
    }
}

@Composable
private fun ManualItemPicker(
    queue: List<PdaItem>,
    onPick: (String) -> Unit,
    onCancel: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.08f))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            "Artikel manuell wählen",
            color = Color.White,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
        )
        queue.forEach { item ->
            Button(
                onClick = { onPick(item.id) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White.copy(alpha = 0.1f),
                    contentColor = Color.White,
                ),
            ) {
                Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.Start) {
                    Text(
                        "${item.menge}× ${item.beschreibung ?: item.artikelnummer ?: "—"}",
                        fontSize = 13.sp,
                    )
                    item.eanCode?.let { ean ->
                        Text(
                            "EAN $ean",
                            fontSize = 10.sp,
                            color = Color.White.copy(alpha = 0.55f),
                            fontFamily = FontFamily.Monospace,
                        )
                    }
                }
            }
        }
        OutlinedButton(
            onClick = onCancel,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp),
        ) {
            Text("Zurück", color = Color.White)
        }
    }
}

@Composable
private fun QueueItemMini(item: PdaItem) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color.White.copy(alpha = 0.04f))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "${item.menge}× ${item.beschreibung ?: item.artikelnummer ?: "—"}",
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 13.sp,
            )
            val tag = when (item.source) {
                "extra" -> "+ Bonus"
                "unknown" -> "→ KB24-Retoure (Falschsendung)"
                else -> item.supplierName ?: "—"
            }
            Text(tag, color = Color.White.copy(alpha = 0.5f), fontSize = 11.sp)
        }
        item.eanCode?.let { ean ->
            Text(
                ean,
                color = Color(0xFF81D4FA),
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
            )
        }
    }
}

/**
 * Zentrale Scan-Logik: ein Code kommt rein, je nach State machen wir
 * was anderes draus.
 *   - Wenn KEIN Item ausgewählt: Code soll EAN sein → Item finden +
 *     selektieren.
 *   - Wenn Item ausgewählt: Code soll Paletten-Code sein → mit
 *     erwarteter Palette vergleichen + linken.
 */
private fun handleScan(
    scannedCode: String,
    selectedItem: PdaItem?,
    queue: List<PdaItem>,
    suggestedContainer: ContainerDto?,
    onSelectItem: (String) -> Unit,
    onLinkToContainer: (containerId: String, itemId: String) -> Unit,
    onError: (String) -> Unit,
) {
    if (selectedItem == null) {
        // Stufe 1: Item finden per EAN
        val match = queue.firstOrNull { !it.eanCode.isNullOrBlank() && it.eanCode == scannedCode }
        if (match != null) {
            onSelectItem(match.id)
        } else {
            onError("EAN $scannedCode passt zu keinem offenen Artikel in der Palette-Queue.")
        }
    } else {
        // Stufe 2: Palette bestätigen
        if (suggestedContainer == null) {
            onError("Noch keine Palette vorgeschlagen — bitte warten oder neu anlegen.")
            return
        }
        if (scannedCode.equals(suggestedContainer.code, ignoreCase = true)) {
            onLinkToContainer(suggestedContainer.id, selectedItem.id)
        } else {
            onError(
                "Paletten-Code passt nicht. Gescannt: \"$scannedCode\" · Erwartet: \"${suggestedContainer.code}\"",
            )
        }
    }
}
