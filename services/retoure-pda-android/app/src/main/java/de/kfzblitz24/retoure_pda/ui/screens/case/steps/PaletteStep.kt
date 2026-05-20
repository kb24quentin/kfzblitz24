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
 * Palette-Step — System sagt PROAKTIV welcher Artikel auf welche
 * Palette gehört, Worker bestätigt durch zwei aufeinanderfolgende
 * Scans (zuerst Artikel-EAN, dann Paletten-Code).
 *
 * Workflow:
 *   STUFE 0 (System-Vorgabe):  Großer Display zeigt
 *                              "NIMM: <Artikel>" + "LEGE AUF: <Palette>"
 *   STUFE 1 (Artikel-Scan):    Worker scannt EAN des Artikels → muss
 *                              zum vorgeschlagenen Item passen, sonst
 *                              Fehlermeldung "Falscher Artikel".
 *   STUFE 2 (Paletten-Scan):   Worker scannt Paletten-Code → muss
 *                              zum vorgeschlagenen Container passen,
 *                              sonst "Falsche Palette".
 *   Bei Erfolg: Item ist verlinkt, Wizard zeigt den nächsten Artikel
 *   in der Queue.
 *
 * Items ohne EAN können nicht per Artikel-Scan bestätigt werden →
 * Fallback-Link "Manuell bestätigen" überspringt Stufe 1 und springt
 * direkt in Stufe 2.
 *
 * Falschsendungen (source="unknown") haben supplierId="kfzblitz24-
 * internal" und werden automatisch auf die KB24-Retoure-Palette
 * geroutet — die wird wie ein normaler Supplier behandelt.
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
    val queue = remember(caseDetail.items) {
        caseDetail.items.filter {
            (it.status == "assessed" && it.verdict != "red") ||
                (it.source == "unknown" && it.status == "assessed")
        }
    }
    val completed = caseDetail.items.count { it.status == "on_pallet" }
    val totalToPalettize = queue.size + completed
    val currentItem = queue.firstOrNull()

    // Lade offene Container für den aktuellen Artikel-Supplier
    var openContainers by remember(currentItem?.supplierId) {
        mutableStateOf<List<ContainerDto>?>(null)
    }
    LaunchedEffect(currentItem?.supplierId) {
        val sid = currentItem?.supplierId ?: return@LaunchedEffect
        openContainers = null
        containerRepository.getOpenContainers(sid)
            .onSuccess { openContainers = it }
            .onFailure { openContainers = emptyList() }
    }
    val suggestedContainer = openContainers?.firstOrNull()

    // State-Machine: itemConfirmed = Worker hat Artikel-EAN gescannt
    var itemConfirmed by remember(currentItem?.id) { mutableStateOf(false) }
    var scanError by remember { mutableStateOf<String?>(null) }
    var showManualInput by remember { mutableStateOf(false) }
    var manualInput by remember(currentItem?.id, itemConfirmed) { mutableStateOf("") }

    // Scanner-Lifecycle
    DisposableEffect(Unit) {
        scanner.startListening()
        onDispose { scanner.stopListening() }
    }

    // Scanner-Subscription: leitet je nach Stufe an die richtige Logik
    LaunchedEffect(currentItem?.id, itemConfirmed, suggestedContainer?.id) {
        scanner.scans.collect { raw ->
            val code = raw.trim()
            if (code.isEmpty()) return@collect
            handleScan(
                scannedCode = code,
                currentItem = currentItem,
                itemConfirmed = itemConfirmed,
                suggestedContainer = suggestedContainer,
                onConfirmItem = { itemConfirmed = true; scanError = null },
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
        if (currentItem == null) return@Column

        // ── Fehler-Banner ───────────────────────────────────────────
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

        val chosenSupplier = suppliers.find { it.id == currentItem.supplierId }

        // ── PROAKTIVE ANZEIGE: NIMM + LEGE AUF ───────────────────────
        ProactivePalletInstruction(
            item = currentItem,
            suggestedContainer = suggestedContainer,
            supplierName = chosenSupplier?.name,
            isInternal = currentItem.supplierId == "kfzblitz24-internal",
            itemConfirmed = itemConfirmed,
        )

        when {
            // ── Keine offene Palette → neue anlegen ─────────────────
            openContainers != null && suggestedContainer == null -> {
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
                        "Lege eine neue Palette an — Code wird vergeben und das Label kann gedruckt werden.",
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 12.sp,
                    )
                }
                BigButton(
                    text = if (actionLoading) "Lege an…"
                           else "+ Neue Palette für ${chosenSupplier?.name ?: "Lieferant"}",
                    onClick = {
                        currentItem.supplierId?.let { sid ->
                            onCreateContainerAndLink(sid, currentItem.id)
                        }
                    },
                    loading = actionLoading,
                )
            }

            openContainers == null -> {
                Box(modifier = Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Orange)
                }
            }

            else -> {
                // Status-Zeile: was wird als nächstes erwartet?
                val nextScanLabel = if (!itemConfirmed) {
                    "1. Scanne den Artikel-EAN zur Bestätigung"
                } else {
                    "2. Scanne den Paletten-Code zur Bestätigung"
                }
                Text(
                    nextScanLabel,
                    color = Color.White,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                )

                // Manueller Modus — default versteckt
                if (showManualInput) {
                    OutlinedTextField(
                        value = manualInput,
                        onValueChange = { manualInput = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = {
                            Text(
                                if (!itemConfirmed) "EAN manuell eingeben"
                                else "Paletten-Code manuell eingeben",
                                color = Color.White.copy(alpha = 0.4f),
                            )
                        },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = if (!itemConfirmed) KeyboardType.Number else KeyboardType.Ascii,
                            imeAction = ImeAction.Done,
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                handleScan(
                                    scannedCode = manualInput.trim(),
                                    currentItem = currentItem,
                                    itemConfirmed = itemConfirmed,
                                    suggestedContainer = suggestedContainer,
                                    onConfirmItem = {
                                        itemConfirmed = true
                                        scanError = null
                                        manualInput = ""
                                    },
                                    onLinkToContainer = { cid, iid ->
                                        onLinkToContainer(cid, iid)
                                        manualInput = ""
                                    },
                                    onError = { msg -> scanError = msg },
                                )
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
                } else {
                    TextButton(
                        onClick = { showManualInput = true },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            "⌨ Code manuell eingeben",
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 12.sp,
                        )
                    }
                }

                // Fallback wenn Artikel keinen EAN hat
                if (!itemConfirmed && currentItem.eanCode.isNullOrBlank()) {
                    TextButton(
                        onClick = { itemConfirmed = true; scanError = null },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            "Artikel hat keinen EAN — manuell als bestätigt markieren",
                            color = Color.White.copy(alpha = 0.5f),
                            fontSize = 12.sp,
                        )
                    }
                }
            }
        }
    }
}

/**
 * Die GROßE proaktive Anzeige am oberen Bildschirm-Drittel:
 *
 *   ┌────────────────────────────────────┐
 *   │ NIMM                               │
 *   │ Bosch F00VP01004                   │  ← große Artikelnummer
 *   │ Dichtring, Düsenhalter             │  ← Beschreibung
 *   │ EAN 4047023217790                  │
 *   ├────────────────────────────────────┤
 *   │ LEGE AUF                           │
 *   │ IP-042                             │  ← GROSSER Paletten-Code
 *   │ → Interparts                       │
 *   └────────────────────────────────────┘
 *
 * Wenn der Artikel-Scan bestätigt ist, kriegt die obere Hälfte einen
 * grünen Haken-Indikator damit der Worker auf den ersten Blick sieht
 * dass er bei Stufe 2 (Palette) ist.
 */
@Composable
private fun ProactivePalletInstruction(
    item: PdaItem,
    suggestedContainer: ContainerDto?,
    supplierName: String?,
    isInternal: Boolean,
    itemConfirmed: Boolean,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White.copy(alpha = 0.06f)),
    ) {
        // ── NIMM-Block ──────────────────────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    if (itemConfirmed) Color(0x3300C853) else Color.Transparent,
                )
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (itemConfirmed) "✓ ARTIKEL BESTÄTIGT" else "NIMM JETZT",
                    color = if (itemConfirmed) Color(0xFFB9F6CA) else Color.White.copy(alpha = 0.7f),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.8.sp,
                )
            }
            Spacer(Modifier.height(4.dp))
            // GROSSE Artikelnummer (oder Beschreibung wenn keine Nummer)
            val bigText = item.artikelnummer ?: item.beschreibung ?: "—"
            Text(
                bigText,
                color = Color.White,
                fontSize = 26.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
            )
            item.hersteller?.let { h ->
                Text(h, color = Color.White.copy(alpha = 0.75f), fontSize = 14.sp)
            }
            if (item.beschreibung != null && item.artikelnummer != null) {
                Text(
                    item.beschreibung,
                    color = Color.White.copy(alpha = 0.65f),
                    fontSize = 13.sp,
                )
            }
            item.eanCode?.let { ean ->
                Text(
                    "EAN $ean",
                    color = Color(0xFF81D4FA),
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                )
            }
            if (item.menge > 1) {
                Text(
                    "Menge: ${item.menge}× (Stk. ${(item.scanCount ?: 0) + 1})",
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 12.sp,
                )
            }
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(Color.White.copy(alpha = 0.1f)),
        )

        // ── LEGE-AUF-Block ──────────────────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Orange.copy(alpha = 0.12f))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "LEGE AUF",
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp,
            )
            Spacer(Modifier.height(4.dp))
            // RIESIGER Paletten-Code
            Text(
                suggestedContainer?.code ?: "wird zugewiesen …",
                color = Orange,
                fontSize = 42.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                textAlign = TextAlign.Center,
            )
            Text(
                if (isInternal) "→ KB24-LAGER (intern)"
                else "→ ${supplierName ?: "Lieferant"}",
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

/**
 * Zentrale Scan-Logik je nach State:
 *   - itemConfirmed=false: Code = Artikel-EAN, muss zu currentItem passen
 *   - itemConfirmed=true:  Code = Paletten-Code, muss zu suggestedContainer passen
 */
private fun handleScan(
    scannedCode: String,
    currentItem: PdaItem?,
    itemConfirmed: Boolean,
    suggestedContainer: ContainerDto?,
    onConfirmItem: () -> Unit,
    onLinkToContainer: (containerId: String, itemId: String) -> Unit,
    onError: (String) -> Unit,
) {
    if (currentItem == null) return

    if (!itemConfirmed) {
        // Stufe 1: Artikel-EAN bestätigen
        val expectedEan = currentItem.eanCode
        if (expectedEan.isNullOrBlank()) {
            onError(
                "Artikel hat keinen EAN — bitte unten manuell bestätigen.",
            )
            return
        }
        if (scannedCode == expectedEan) {
            onConfirmItem()
        } else {
            onError(
                "Falscher Artikel. Gescannt: \"$scannedCode\" · Erwartet: \"$expectedEan\" " +
                    "(${currentItem.beschreibung ?: currentItem.artikelnummer ?: "—"})",
            )
        }
    } else {
        // Stufe 2: Paletten-Code bestätigen
        if (suggestedContainer == null) {
            onError("Noch keine Palette vorgeschlagen — bitte warten oder neu anlegen.")
            return
        }
        if (scannedCode.equals(suggestedContainer.code, ignoreCase = true)) {
            onLinkToContainer(suggestedContainer.id, currentItem.id)
        } else {
            onError(
                "Falsche Palette. Gescannt: \"$scannedCode\" · Erwartet: \"${suggestedContainer.code}\"",
            )
        }
    }
}
